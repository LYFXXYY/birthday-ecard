/**
 * 独立监控项目 - 入口文件
 *
 * 从外部视角监控生日贺卡系统运行状态。
 * 定时执行 4 类检测：HTTP 健康检查、端口存活、心跳文件、数据库直连。
 * 异常时输出告警日志，未来可扩展通知渠道。
 */
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { loadConfig } from './config.js';
import { setLogDir, report, alert, cleanupOldLogs } from './notifier.js';
import { httpCheck } from './checks/httpCheck.js';
import { portCheck } from './checks/portCheck.js';
import { heartbeatCheck } from './checks/heartbeatCheck.js';
import { dbCheck } from './checks/dbCheck.js';

// ========== 启动 ==========

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = loadConfig();

// 初始化日志目录
setLogDir(config.log.dir);

// 写入 PID 文件（供后端看门狗检测监控进程是否存活）
const monitorRoot = path.resolve(__dirname, '..');
const pidFile = path.join(monitorRoot, 'monitor.pid');
fs.writeFileSync(pidFile, String(process.pid), 'utf-8');

console.log('');
console.log('╔═══════════════════════════════════════╗');
console.log('║   生日贺卡系统 - 独立监控服务         ║');
console.log('╚═══════════════════════════════════════╝');
console.log('');
report({ module: 'system', name: '启动', status: 'ok', message: '监控服务启动' });
report({ module: 'system', name: '配置', status: 'ok', message: `目标: ${config.main.baseUrl}`, });
report({ module: 'system', name: '配置', status: 'ok', message: `检测频率: HTTP=${config.intervals.httpCheck}s, 端口=${config.intervals.portCheck}s, 心跳=${config.intervals.heartbeatCheck}s, DB=${config.intervals.dbCheck}s` });
console.log('');

// ========== 后端自动重启（双向守护） ==========

const restartHistory = [];       // 重启时间戳记录（滑动窗口）
const RESTART_WINDOW_MS = 5 * 60 * 1000;  // 5 分钟滑动窗口
const MAX_RESTARTS = 3;          // 窗口内最多重启次数
const RESTART_COOLDOWN_MS = 60 * 1000;    // 两次重启最少间隔 60 秒

/**
 * 滑动窗口检查：是否允许重启后端
 * - 5 分钟内重启不超过 3 次（防止死循环）
 * - 两次重启间隔至少 60 秒（给启动留时间）
 */
const canRestartBackend = () => {
  const now = Date.now();
  // 清除窗口外的记录
  while (restartHistory.length > 0 && now - restartHistory[0] > RESTART_WINDOW_MS) {
    restartHistory.shift();
  }
  if (restartHistory.length >= MAX_RESTARTS) return false;
  if (restartHistory.length > 0 && now - restartHistory[restartHistory.length - 1] < RESTART_COOLDOWN_MS) return false;
  return true;
};

/**
 * 重启后端进程
 */
const restartBackend = () => {
  const backendDir = path.resolve(__dirname, '..', '..');
  const backendEntry = path.join(backendDir, 'src', 'app.js');

  if (!fs.existsSync(backendEntry)) {
    alert('system', '后端重启', `入口文件不存在: ${backendEntry}`);
    return;
  }

  report({ module: 'system', name: '后端重启', status: 'warning', message: '正在启动后端服务...' });

  const child = spawn(process.execPath, [backendEntry], {
    cwd: backendDir,
    stdio: 'ignore',
    detached: true
  });
  child.unref();

  restartHistory.push(Date.now());
  const remaining = MAX_RESTARTS - restartHistory.length;
  alert('system', '后端重启', `已启动后端进程 (PID: ${child.pid})，5 分钟内还可重启 ${remaining} 次`);
};

/**
 * 评估是否需要重启后端
 * 触发条件：HTTP 和端口检测同时失败（排除单点误报）
 */
let lastHttpOk = true;
let lastPortOk = true;

const evaluateRestart = (result) => {
  // 更新各项状态
  if (result.module === 'http') lastHttpOk = result.status === 'ok';
  if (result.module === 'port') lastPortOk = result.status === 'ok';

  // 后端正常时不处理
  if (lastHttpOk && lastPortOk) return;

  // 检查是否有新监控接管（后端重启后会 spawn 新监控，PID 文件会被覆盖）
  try {
    if (fs.existsSync(pidFile)) {
      const filePid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      if (filePid && filePid !== process.pid) {
        try {
          process.kill(filePid, 0); // 新监控进程确实存在
          report({ module: 'system', name: '监控交接', status: 'ok', message: `新监控进程 (PID: ${filePid}) 已接管，本实例退出` });
          process.exit(0);
        } catch { /* 新 PID 不存在，继续 */ }
      }
    }
  } catch { /* 忽略文件读取错误 */ }

  // 只有 HTTP + 端口同时失败才判定后端崩溃（避免单点误报）
  if (!lastHttpOk && !lastPortOk && canRestartBackend()) {
    restartBackend();
  } else if (!lastHttpOk && !lastPortOk) {
    alert('system', '后端重启', '后端疑似崩溃，但重启冷却中（5 分钟内最多 3 次，间隔至少 60 秒）');
  }
};

// ========== 检测执行函数 ==========

/**
 * 执行单次检测并处理结果
 */
const runCheck = async (checkFn, checkConfig) => {
  try {
    const result = await checkFn(checkConfig);
    report(result);

    // 异常时触发告警
    if (result.status === 'error') {
      alert(result.module, result.name, result.message);
    }

    // 评估是否需要重启后端（双向守护）
    evaluateRestart(result);

    return result;
  } catch (err) {
    const errorResult = {
      module: 'unknown',
      name: '未知检测',
      status: 'error',
      message: `检测执行异常: ${err.message}`
    };
    report(errorResult);
    alert('system', '检测异常', err.message);
    return errorResult;
  }
};

// ========== 定时任务注册 ==========

// 1. HTTP 健康检查
let httpCronExpr;
if (config.intervals.httpCheck >= 60) {
  const minutes = Math.floor(config.intervals.httpCheck / 60);
  httpCronExpr = `*/${minutes} * * * *`;
} else {
  httpCronExpr = `*/${config.intervals.httpCheck} * * * * *`;
}

cron.schedule(httpCronExpr, async () => {
  await runCheck(httpCheck, config.main);
});

// 2. 端口存活检测
const portMinutes = Math.max(1, Math.floor(config.intervals.portCheck / 60));
cron.schedule(`*/${portMinutes} * * * *`, async () => {
  await runCheck(portCheck, config.main);
});

// 3. 心跳文件监控
const heartbeatMinutes = Math.max(1, Math.floor(config.intervals.heartbeatCheck / 60));
cron.schedule(`*/${heartbeatMinutes} * * * *`, async () => {
  await runCheck(heartbeatCheck, config.heartbeat);
});

// 4. 数据库直连检查
const dbMinutes = Math.max(1, Math.floor(config.intervals.dbCheck / 60));
cron.schedule(`*/${dbMinutes} * * * *`, async () => {
  await runCheck(dbCheck, config.database);
});

// 5. 日志清理（每天凌晨 2 点）
cron.schedule('0 2 * * *', () => {
  cleanupOldLogs(config.log.maxDays);
}, { timezone: 'Asia/Shanghai' });

// ========== 启动时立即执行一次全量检测 ==========

const initialCheck = async () => {
  report({ module: 'system', name: '启动', status: 'ok', message: '执行首次全量检测...' });
  console.log('');

  const results = await Promise.all([
    runCheck(httpCheck, config.main),
    runCheck(portCheck, config.main),
    runCheck(heartbeatCheck, config.heartbeat),
    runCheck(dbCheck, config.database)
  ]);

  const okCount = results.filter(r => r.status === 'ok').length;
  const errCount = results.filter(r => r.status === 'error').length;
  const warnCount = results.filter(r => r.status === 'warning').length;

  console.log('');
  report({
    module: 'system',
    name: '首次检测',
    status: errCount > 0 ? 'error' : warnCount > 0 ? 'warning' : 'ok',
    message: `完成: ${okCount} 正常, ${warnCount} 警告, ${errCount} 异常`
  });
  console.log('');
};

await initialCheck();

// ========== 优雅退出 ==========

const shutdown = (signal) => {
  report({ module: 'system', name: '关闭', status: 'ok', message: `收到 ${signal}，监控服务关闭` });
  // 删除 PID 文件，防止后端看门狗误判为异常退出
  try { fs.unlinkSync(pidFile); } catch { /* 忽略 */ }
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
