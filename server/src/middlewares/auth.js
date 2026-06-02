import { verifyToken } from '../utils/jwt.js';
import { success, error } from '../utils/response.js';

// JWT认证中间件
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未提供认证Token', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // 将用户信息挂载到request
    next();
  } catch (err) {
    return error(res, 'Token无效或已过期', 401);
  }
};