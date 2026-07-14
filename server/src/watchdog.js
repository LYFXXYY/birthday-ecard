/**
 * 外部监控守护进程（Watchdog）
 *
 * 两种运行模式：
 * 1. fork 模式：由主服务 app.js 通过 child_process.fork() 启动
 * 2. 独立模式：node watchdog.js 独立运行（推荐生产环境用 PM2 单独管理）
 *
 * 告警输出：
 * - logFileProvider：写入 logs/watchdog.log + logs/error.log
 * - dbLogProvider：写入 system_logs 表（category='watchdog'）
 */
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import fs from 'fs/promises';
import log4js from 'log4js';
import { fileURLToPath } from 'url';

// 加载 .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// database.js 内部也有 dotenv.config()，会自行加载
import { sequelize } from './config/database.js';
import { SystemLog } from './models/index.js';

// ========== 守护进程独立的 log4js 配置 ==========
const logsDir = path.join(__dirname, '..', 'logs');

log4js.configure({
  appenders: {
    console: {
      type: 'stdout',
      layout: { type: 'pattern', pattern: '%[%d{yyyy-MM-dd hh:mm:ss} %p %category%] %m' }
    },
    watchdogFile: {
      type: 'dateFile',
      filename: path.join(logsDir, 'watchdog.log'),
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      numBackups: 30,
      compress: true,
      layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %category %m' }
    },
    errorFile: {
      type: 'dateFile',
      filename: path.join(logsDir, 'error.log'),
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      numBackups: 30,
      compress: true,
      layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %category %m' },
      level: 'error'
    }
  },
  categories: {
    default: { appenders: ['console', 'watchdogFile', 'errorFile'], level: 'debug' }
  }
});

const logger = log4js.getLogger('watchdog');

// ========== 配置 ==========
const WATCHDOG_FAULT = process.env.WATCHDOG_FAULT === 'true';
const WATCHDOG_CONFIG = {
  checkIntervalMs: (parseInt(process.env.WATCHDOG_INTERVAL) || 30) * 1000,
  httpTimeoutMs: parseInt(process.env.WATCHDOG_HTTP_TIMEOUT) || 5000,
  heartbeatTimeoutMs: 25 * 60 * 60 * 1000,
  // WATCHDOG_FAULT=true 时检查不存在的端口，模拟主服务宕机
  healthUrl: WATCHDOG_FAULT
    ? 'http://localhost:19999/api/health'
    : `http://localhost:${process.env.PORT || 3000}/api/health`,
  heartbeatsDir: path.join(__dirname, '..', 'heartbeats')
};

// ========== 检查状态跟踪（状态机去重） ==========
const checkStates = {
  http: 'unknown',
  senderHeartbeat: 'unknown',
  database: 'unknown'
};

// ========== 健康检查函数 ==========

function checkHttpHealth() {
  return new Promise((resolve) => {
    const url = new URL(WATCHDOG_CONFIG.healthUrl);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      timeout: WATCHDOG_CONFIG.httpTimeoutMs
    }, (res) => {
      if (res.statusCode === 200) {
        resolve({ name: 'http', status: 'healthy', message: 'HTTP 服务正常' });
      } else {
        resolve({ name: 'http', status: 'unhealthy', message: `HTTP 返回状态码 ${res.statusCode}` });
      }
      res.resume();
    });
    req.on('error', (err) => {
      resolve({ name: 'http', status: 'unhealthy', message: `HTTP 连接失败: ${err.code || err.message}` });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ name: 'http', status: 'unhealthy', message: `HTTP 请求超时 (${WATCHDOG_CONFIG.httpTimeoutMs}ms)` });
    });
    req.end();
  });
}

async function checkSenderHeartbeat() {
  try {
    const filePath = path.join(WATCHDOG_CONFIG.heartbeatsDir, 'sender.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    const lastBeat = data.last_beat;
    if (!lastBeat) {
      return { name: 'senderHeartbeat', status: 'unhealthy', message: '心跳文件无 last_beat 字段' };
    }
    const elapsed = Date.now() - new Date(lastBeat).getTime();
    if (elapsed > WATCHDOG_CONFIG.heartbeatTimeoutMs) {
      const hours = (elapsed / (1000 * 60 * 60)).toFixed(1);
      return { name: 'senderHeartbeat', status: 'unhealthy', message: `发送服务心跳超时 (${hours}h)`, detail: { lastBeat } };
    }
    return { name: 'senderHeartbeat', status: 'healthy', message: '发送服务心跳正常' };
  } catch (err) {
    return { name: 'senderHeartbeat', status: 'unhealthy', message: `心跳文件读取失败: ${err.code || err.message}` };
  }
}

async function checkDatabase() {
  try {
    await sequelize.query('SELECT 1');
    return { name: 'database', status: 'healthy', message: '数据库连接正常' };
  } catch (err) {
    return { name: 'database', status: 'unhealthy', message: `数据库连接失败: ${err.message}` };
  }
}

// ========== 告警 Provider ==========

/** Provider 1：写入日志文件 */
async function logFileProvider(alert) {
  const fn = alert.level === 'error' ? 'error' : alert.level === 'info' ? 'info' : 'warn';
  logger[fn](`[告警] ${alert.name}: ${alert.message}`);
}

/** Provider 2：写入数据库 system_logs 表 */
async function dbLogProvider(alert) {
  await SystemLog.create({
    level: alert.level || 'warn',
    category: 'watchdog',
    message: alert.message?.substring(0, 500) || '',
    metadata: { check: alert.name, ...alert.detail }
  });
}

const alertProviders = [logFileProvider, dbLogProvider];

async function sendAlert(alert) {
  for (const provider of alertProviders) {
    try {
      await provider(alert);
    } catch (_) {
      // 单个 provider 失败不阻塞其他 provider
    }
  }
}

// ========== 守护进程自身心跳 ==========

async function writeWatchdogHeartbeat() {
  const filePath = path.join(WATCHDOG_CONFIG.heartbeatsDir, 'watchdog.json');
  await fs.mkdir(WATCHDOG_CONFIG.heartbeatsDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ last_beat: new Date().toISOString() }, null, 2), 'utf-8');
}

// ========== 主检查循环 ==========

async function runCheckCycle() {
  const results = await Promise.all([
    checkHttpHealth(),
    checkSenderHeartbeat(),
    checkDatabase()
  ]);

  for (const result of results) {
    const prevState = checkStates[result.name];
    const newState = result.status;
    checkStates[result.name] = newState;

    if (prevState !== newState) {
      if (newState === 'unhealthy') {
        await sendAlert({
          level: result.name === 'database' ? 'error' : 'warn',
          name: result.name,
          message: `[守护进程告警] ${result.message}`,
          detail: result.detail
        });
      } else if (prevState === 'unhealthy' && newState === 'healthy') {
        await sendAlert({
          level: 'info',
          name: result.name,
          message: `[守护进程恢复] ${result.name} 已恢复正常`
        });
      }
    }
  }

  await writeWatchdogHeartbeat();
}

// ========== IPC 信号处理 ==========

let checkTimer = null;

process.on('message', (msg) => {
  if (msg === 'shutdown') {
    logger.info('[守护进程] 收到关闭信号，正在退出...');
    if (checkTimer) clearInterval(checkTimer);
    sequelize.close().catch(() => {});
    process.exit(0);
  }
});

process.on('disconnect', () => {
  // fork 模式下主进程退出时会触发 disconnect
  // 独立模式下不会触发
  if (checkTimer) clearInterval(checkTimer);
  logger.info('[守护进程] 主进程断开连接，守护进程退出');
  process.exit(0);
});

// ========== 启动 ==========

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('[守护进程] 数据库连接成功');
  } catch (err) {
    logger.error(`[守护进程] 数据库连接失败: ${err.message}`);
  }

  await writeWatchdogHeartbeat();
  await runCheckCycle();

  checkTimer = setInterval(runCheckCycle, WATCHDOG_CONFIG.checkIntervalMs);

  const isForked = !!process.send;
  const mode = isForked ? 'fork' : '独立';
  logger.info(`[守护进程] 已启动（${mode}模式），检查间隔 ${WATCHDOG_CONFIG.checkIntervalMs / 1000}s，监控地址 ${WATCHDOG_CONFIG.healthUrl}${WATCHDOG_FAULT ? ' 【故障模拟模式】' : ''}`);
}

start().catch((err) => {
  logger.error(`[守护进程] 启动失败: ${err.message}`);
  process.exit(1);
});
