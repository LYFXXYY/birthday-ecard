// 日志工具 - 基于 log4js
// 日志文件输出到 server/logs/，按日期轮转
import log4js from 'log4js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.resolve(__dirname, '../../logs');

log4js.configure({
  appenders: {
    // 控制台输出
    console: {
      type: 'stdout',
      layout: {
        type: 'pattern',
        pattern: '%[%d{yyyy-MM-dd hh:mm:ss} %p %category%] %m'
      }
    },
    // 按日期轮转的文件（主日志）
    file: {
      type: 'dateFile',
      filename: path.join(logsDir, 'app.log'),
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      numBackups: 30,
      compress: true,
      layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %category %m'
      }
    },
    // 错误日志单独文件
    errorFile: {
      type: 'dateFile',
      filename: path.join(logsDir, 'error.log'),
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      numBackups: 30,
      compress: true,
      layout: {
        type: 'pattern',
        pattern: '%d{yyyy-MM-dd hh:mm:ss} %p %category %m'
      },
      // 只接收 error 及以上级别
      level: 'error'
    }
  },
  categories: {
    default: {
      appenders: ['console', 'file', 'errorFile'],
      level: 'debug'
    },
    // 生产环境可设为 info 减少输出量
    prod: {
      appenders: ['file', 'errorFile'],
      level: 'info'
    }
  }
});

/**
 * 获取指定分类的 logger
 * @param {string} category - 分类名（如 'scheduler', 'send', 'card' 等）
 */
export const getLogger = (category) => log4js.getLogger(category);

// 导出默认 logger
export const logger = log4js.getLogger('app');
