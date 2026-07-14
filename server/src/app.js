import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';

// 必须在任何其他模块导入之前加载环境变量
dotenv.config();

import { sequelize } from './config/database.js';
import { config } from './config/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import templateRoutes from './routes/templates.js';
import blessingRoutes from './routes/blessings.js';
import recordRoutes from './routes/records.js';
import cardRoutes from './routes/card.js';
import departmentRoutes from './routes/departments.js';
import operationLogRoutes from './routes/operationLogs.js';
import monitorRoutes from './routes/monitor.js';
import systemLogRoutes from './routes/systemLogs.js';
import smsCallbackRoutes from './routes/smsCallback.js';
import smsConfigRoutes from './routes/smsConfig.js';
import { authMiddleware } from './middlewares/auth.js';
import initDefaultAdmin from './utils/initAdmin.js';
import initDefaultTemplate from './utils/initDefaultTemplate.js';
import { initTestEmployees } from './utils/initTestEmployees.js';
import { getLogger } from './utils/logger.js';
import { startBirthdayScheduler } from './services/scheduler.js';
import migrateDatabase from './utils/migrate.js';

const logger = getLogger('app');

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== 守护进程管理 ==========
let watchdogProcess = null;
let shuttingDown = false;

function startWatchdog() {
  if (shuttingDown) return;
  if (!config.watchdog.enabled) {
    logger.info('[守护进程] 已通过配置禁用');
    return;
  }

  const watchdogPath = path.join(__dirname, 'watchdog.js');
  watchdogProcess = fork(watchdogPath, [], { cwd: process.cwd() });

  watchdogProcess.on('exit', (code, signal) => {
    logger.warn(`[守护进程] 已退出，code=${code}, signal=${signal}`);
    watchdogProcess = null;
    if (!shuttingDown) {
      const delay = config.watchdog.restartDelayMs;
      logger.info(`[守护进程] 将在 ${delay / 1000}s 后重启...`);
      setTimeout(startWatchdog, delay);
    }
  });

  watchdogProcess.on('error', (err) => {
    logger.error(`[守护进程] 启动失败: ${err.message}`);
    watchdogProcess = null;
  });

  logger.info(`[守护进程] 已启动，PID=${watchdogProcess.pid}`);
}

function startWatchdogMonitor() {
  if (!config.watchdog.enabled) return;
  const checkInterval = config.watchdog.intervalSeconds * 1000;
  const staleThreshold = checkInterval * 3;

  setInterval(async () => {
    if (!watchdogProcess || shuttingDown) return;
    try {
      const hbPath = path.join(__dirname, '..', 'heartbeats', 'watchdog.json');
      const content = await fs.readFile(hbPath, 'utf-8');
      const data = JSON.parse(content);
      const elapsed = Date.now() - new Date(data.last_beat).getTime();
      if (elapsed > staleThreshold) {
        logger.warn(`[守护进程] 心跳超时 (${(elapsed / 1000).toFixed(0)}s)，正在重启...`);
        watchdogProcess.kill('SIGTERM');
      }
    } catch {
      // 文件不存在或解析失败，首次启动时正常
    }
  }, checkInterval);
}

function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[服务器] 收到 ${signal}，正在关闭...`);

  if (watchdogProcess) {
    watchdogProcess.send('shutdown');
    setTimeout(() => {
      if (watchdogProcess) watchdogProcess.kill('SIGKILL');
      process.exit(0);
    }, 3000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 确保必要的目录存在
async function ensureDirectories() {
  const dirs = [config.cardsDir, config.videosDir, config.uploadsDir];
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      logger.error(`[启动] 创建目录失败: ${dir} - ${err.message}`);
    }
  }
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 静态文件服务（uploads 目录下的 logo 等资源）
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

// 健康检查（无需认证）
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.query('SELECT 1');
    res.json({ code: 200, message: 'OK', data: { status: 'healthy', timestamp: new Date() } });
  } catch (err) {
    res.status(503).json({ code: 503, message: 'Service Unhealthy', data: { status: 'unhealthy', error: err.message, timestamp: new Date() } });
  }
});

// CSP 短信投递状态回调（公开端点，供运营商服务器调用，XML 请求体）
app.use('/api/sms-callback', express.text({ type: ['text/xml', 'application/xml'] }), smsCallbackRoutes);

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/blessings', blessingRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/operation-logs', operationLogRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/system-logs', systemLogRoutes);
app.use('/api/admin/sms-config', authMiddleware, smsConfigRoutes);

// 贺卡访问路由（公开）
app.use('/card', cardRoutes);

// 视频文件静态服务（公开，用于贺卡视频访问）
app.use('/video', express.static(path.resolve(config.videosDir)));

// 全局错误处理
app.use(errorHandler);

// 启动服务
const startServer = async () => {
  try {
    // 确保工作目录存在
    await ensureDirectories();

    // 迁移：先为已存在的表添加新增列（避免 sync 创建索引时列不存在）
    await migrateDatabase();

    // 同步表结构：创建尚不存在的表
    await sequelize.sync();
    logger.info('[数据库] 连接成功');

    await initDefaultAdmin();
    await initDefaultTemplate();
    await initTestEmployees();

    // 启动定时任务
    startBirthdayScheduler();

    app.listen(config.port, () => {
      logger.info(`[服务器] 运行在 http://localhost:${config.port}`);
      // 启动守护进程
      startWatchdog();
      startWatchdogMonitor();
    });
  } catch (err) {
    logger.error('[启动失败]', err);
    process.exit(1);
  }
};

startServer();

export default app;