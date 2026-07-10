/**
 * 系统日志写入工具
 * 提供便捷的函数将系统事件写入 system_logs 表
 */
import { SystemLog } from '../models/index.js';
import { getLogger } from './logger.js';

const logger = getLogger('systemLog');

/**
 * 写入系统日志
 * @param {object} options
 * @param {string} options.level - 日志级别：'info' | 'warn' | 'error'
 * @param {string} options.category - 分类：'scheduler' | 'heartbeat' | 'send' | 'system' 等
 * @param {string} options.message - 日志消息
 * @param {object|null} [options.metadata] - 附加元数据
 */
export const writeSystemLog = async ({ level, category, message, metadata = null }) => {
  try {
    await SystemLog.create({
      level: level || 'info',
      category: category || 'system',
      message: message?.substring(0, 500) || '',
      metadata
    });
  } catch (err) {
    // 系统日志写入失败不应影响主业务
    logger.error(`[系统日志] 写入失败: ${err.message}`);
  }
};

/**
 * 快捷方法：写入 info 级别日志
 */
export const logInfo = (category, message, metadata = null) =>
  writeSystemLog({ level: 'info', category, message, metadata });

/**
 * 快捷方法：写入 warn 级别日志
 */
export const logWarn = (category, message, metadata = null) =>
  writeSystemLog({ level: 'warn', category, message, metadata });

/**
 * 快捷方法：写入 error 级别日志
 */
export const logError = (category, message, metadata = null) =>
  writeSystemLog({ level: 'error', category, message, metadata });
