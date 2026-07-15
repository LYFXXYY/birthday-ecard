import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import cron from 'node-cron';

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

// ========== 监控进程管理 ==========
let monitorProcess = null;
const monitorPidFile = path.resolve(__dirname, '..', 'monitor', 'monitor.pid');

const spawnMonitor = () => {
  const monitorDir = path.resolve(__dirname, '..', 'monitor');
  const monitorEntry = path.join(monitorDir, 'src', 'app.js');

  if (!existsSync(monitorEntry)) {
    logger.warn(`[监控] 监控入口不存在: ${monitorEntry}，跳过启动`);
    return;
  }

  logger.info('[监控] 启动独立监控进程...');

  // detached: true 使监控进程脱离父进程，后端崩溃时监控继续运行
  // stdio: stdout 用 pipe 转发到终端，stderr 用 ignore（监控自身写文件日志）
  // 后端崩溃后管道断裂，Node.js console.log 写入断裂管道不会导致监控崩溃
  monitorProcess = spawn(process.execPath, [monitorEntry], {
    cwd: monitorDir,
    stdio: ['ignore', 'pipe', 'ignore'],
    detached: true
  });

  // 将监控项目的终端输出转发到后端日志（带 [监控] 前缀）
  monitorProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) logger.info(`[监控] ${line}`);
    });
  });

  // 解除引用，允许父进程在子进程退出前正常退出
  monitorProcess.unref();
};

/**
 * 检查监控进程是否存活，若异常退出则自动重启
 * 通过 PID 文件判断：文件不存在 → 未启动过或已正常退出；
 * 文件存在但进程不存在 → 异常崩溃，需要重启
 */
const checkMonitor = () => {
  if (!existsSync(monitorPidFile)) {
    // PID 文件不存在：可能从未启动，或监控已正常退出（正常退出时会删除 PID 文件）
    // 如果 monitorProcess 引用还在，说明进程可能异常退出但未清理
    if (monitorProcess) {
      logger.warn('[监控] 监控进程已退出，正在重启...');
      monitorProcess = null;
      spawnMonitor();
    }
    return;
  }

  try {
    const pid = parseInt(readFileSync(monitorPidFile, 'utf-8').trim(), 10);
    if (!pid || isNaN(pid)) return;
    // signal 0 不发送实际信号，只检测进程是否存在（跨平台兼容）
    process.kill(pid, 0);
  } catch {
    // 进程不存在（ESRCH）→ 异常崩溃，需要重启
    logger.warn('[监控] 检测到监控进程异常退出，正在重启...');
    monitorProcess = null;
    spawnMonitor();
  }
};

const cleanupMonitor = () => {
  if (existsSync(monitorPidFile)) {
    try {
      const pid = parseInt(readFileSync(monitorPidFile, 'utf-8').trim(), 10);
      if (pid && !isNaN(pid)) {
        process.kill(pid, 'SIGTERM');
      }
    } catch { /* 进程可能已退出，忽略 */ }
  }
  monitorProcess = null;
};

// 优雅退出时清理监控进程
process.on('SIGTERM', () => {
  cleanupMonitor();
  process.exit(0);
});
process.on('SIGINT', () => {
  cleanupMonitor();
  process.exit(0);
});

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
      // 启动独立监控进程
      spawnMonitor();

      // 监控看门狗：每 2 分钟检查监控进程是否存活，异常退出时自动重启
      cron.schedule('*/2 * * * *', () => {
        checkMonitor();
      });
    });
  } catch (err) {
    logger.error('[启动失败]', err);
    process.exit(1);
  }
};

startServer();

export default app;