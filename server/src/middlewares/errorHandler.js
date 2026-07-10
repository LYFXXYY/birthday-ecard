// 全局错误处理中间件
import { getLogger } from '../utils/logger.js';

const logger = getLogger('app');

export const errorHandler = (err, req, res, next) => {
  logger.error(`[错误] ${err.message}`);

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message;

  res.status(statusCode).json({
    code: statusCode,
    message,
    data: null
  });
};