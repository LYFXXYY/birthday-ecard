import { verifyToken } from '../utils/jwt.js';
import { success, error } from '../utils/response.js';
import { ActiveSession } from '../models/index.js';
import { config } from '../config/index.js';

// JWT认证中间件
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未提供认证Token', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    // 检查 ActiveSession 表，确认会话有效
    const session = await ActiveSession.findOne({ where: { token } });
    if (!session) {
      return error(res, '会话已失效，请重新登录', 401);
    }

    const now = new Date();

    // 检查绝对过期时间（与 JWT 过期时间一致）
    if (session.expires_at && new Date(session.expires_at) < now) {
      await session.destroy();
      return error(res, '会话已过期，请重新登录', 401);
    }

    // 检查空闲超时（30分钟无操作）
    const idleMs = now - new Date(session.last_activity);
    const timeoutMs = config.sessionTimeoutMinutes * 60 * 1000;
    if (idleMs > timeoutMs) {
      await session.destroy();
      return error(res, '长时间未操作，会话已超时，请重新登录', 401);
    }

    // 更新最后活动时间
    await session.update({ last_activity: now });

    req.user = decoded; // 将用户信息挂载到request
    next();
  } catch (err) {
    return error(res, 'Token无效或已过期', 401);
  }
};