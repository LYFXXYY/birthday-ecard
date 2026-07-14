// 日志工具 - 基于 log4js
// 日志文件输出到 server/logs/，按日期轮转
// 开发环境：终端 + 文件，生产环境：仅文件
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

// ESM 中 import 先于模块体执行，必须提前加载 .env
const __envFile = fileURLToPath(import.meta.url);
const __envDir = path.dirname(__envFile);
dotenv.config({ path: path.join(__envDir, '../../.env') });

import log4js from 'log4js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.resolve(__dirname, '../../logs');

const isProd = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

// 开发环境输出到终端，生产环境仅写文件
const defaultAppenders = isProd
  ? ['file', 'errorFile']
  : ['console', 'file', 'errorFile'];

log4js.configure({
  appenders: {
    // 控制台输出（仅开发环境使用）
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
      level: 'error'
    }
  },
  categories: {
    default: {
      appenders: defaultAppenders,
      level: logLevel
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
