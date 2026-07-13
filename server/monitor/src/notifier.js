/**
 * 通知模块
 *
 * 当前阶段：输出到控制台 + 写入日志文件。
 * 未来可扩展：对接短信/邮件/IM 通知。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let logDir = path.resolve(__dirname, '..', 'logs');

/**
 * 设置日志目录（从配置中读取后调用）
 */
export const setLogDir = (dir) => {
  logDir = path.resolve(dir);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
};

/**
 * 获取当前日志文件名（按日期分文件）
 */
const getLogFilePath = () => {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `monitor-${date}.log`);
};

/**
 * 格式化时间戳
 */
const timestamp = () => {
  return new Date().toLocaleString('zh-CN', { hour12: false });
};

/**
 * 写入日志（同时输出到控制台和文件）
 */
const writeLog = (level, module, message, detail = '') => {
  const ts = timestamp();
  const line = `[${ts}] [${level}] [${module}] ${message}${detail ? ' | ' + detail : ''}`;

  // 控制台输出（带颜色）
  const colors = {
    INFO: '\x1b[32m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    RESET: '\x1b[0m'
  };
  const color = colors[level] || colors.RESET;
  console.log(`${color}${line}${colors.RESET}`);

  // 写入文件
  try {
    fs.appendFileSync(getLogFilePath(), line + '\n', 'utf-8');
  } catch (err) {
    console.error(`[ERROR] 日志写入失败: ${err.message}`);
  }
};

/**
 * 报告检测结果
 *
 * @param {object} result - 检测结果对象
 * @param {string} result.module - 检测模块名
 * @param {string} result.name - 检测项名称
 * @param {'ok'|'warning'|'error'} result.status - 状态
 * @param {string} result.message - 描述信息
 * @param {number} [result.responseTime] - 响应时间(ms)
 */
export const report = (result) => {
  const { module, name, status, message, responseTime } = result;
  const level = status === 'ok' ? 'INFO' : status === 'warning' ? 'WARN' : 'ERROR';
  const rt = responseTime !== undefined ? ` (${responseTime}ms)` : '';
  writeLog(level, module, `${name}: ${message}${rt}`);
};

/**
 * 报告异常告警（醒目格式）
 */
export const alert = (module, name, message) => {
  const ts = timestamp();
  const line = `═══════════════════════════════════════
[${ts}] [ALERT] [${module}] ${name}
  ${message}
═══════════════════════════════════════`;

  console.log(`\x1b[31m${line}\x1b[0m`);

  try {
    fs.appendFileSync(getLogFilePath(), line + '\n', 'utf-8');
  } catch (err) {
    console.error(`[ERROR] 日志写入失败: ${err.message}`);
  }
};

/**
 * 清理过期日志文件
 */
export const cleanupOldLogs = (maxDays = 30) => {
  try {
    const files = fs.readdirSync(logDir);
    const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;

    let cleaned = 0;
    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      const filePath = path.join(logDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      writeLog('INFO', 'system', `已清理 ${cleaned} 个过期日志文件`);
    }
  } catch (err) {
    writeLog('WARN', 'system', `日志清理失败: ${err.message}`);
  }
};
