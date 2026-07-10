/**
 * 系统日志路由
 * GET /api/system-logs - 分页查询系统日志
 * GET /api/system-logs/stats - 日志统计
 */
import { Router } from 'express';
import { Op } from 'sequelize';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { SystemLog } from '../models/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('systemLog');
const router = Router();
router.use(authMiddleware);

// GET /api/system-logs - 分页查询系统日志
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const where = {};

    // 按级别筛选
    if (req.query.level) {
      where.level = req.query.level;
    }

    // 按分类筛选
    if (req.query.category) {
      where.category = req.query.category;
    }

    // 按时间范围筛选
    if (req.query.startDate) {
      where.created_at = where.created_at || {};
      where.created_at[Op.gte] = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      where.created_at = where.created_at || {};
      where.created_at[Op.lte] = new Date(req.query.endDate);
    }

    const { count, rows } = await SystemLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset
    });

    return success(res, {
      list: rows.map(log => ({
        id: log.id,
        level: log.level,
        category: log.category,
        message: log.message,
        metadata: log.metadata,
        created_at: log.created_at
      })),
      total: count,
      page,
      pageSize
    });
  } catch (err) {
    logger.error(`[系统日志] 查询失败: ${err.message}`);
    return error(res, '查询系统日志失败', 500);
  }
});

// GET /api/system-logs/stats - 简单统计
router.get('/stats', async (req, res) => {
  try {
    const { sequelize } = SystemLog;

    // 按级别统计
    const [levelStats] = await sequelize.query(
      'SELECT level, COUNT(*) as count FROM system_logs GROUP BY level ORDER BY count DESC'
    );

    // 按分类统计
    const [categoryStats] = await sequelize.query(
      'SELECT category, COUNT(*) as count FROM system_logs GROUP BY category ORDER BY count DESC'
    );

    // 今日日志数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayCount] = await sequelize.query(
      'SELECT COUNT(*) as count FROM system_logs WHERE created_at >= ?',
      { replacements: [today] }
    );

    // 总记录数
    const [totalCount] = await sequelize.query(
      'SELECT COUNT(*) as count FROM system_logs'
    );

    // 错误数量（最近24小时）
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentErrors] = await sequelize.query(
      'SELECT COUNT(*) as count FROM system_logs WHERE level = ? AND created_at >= ?',
      { replacements: ['error', last24h] }
    );

    return success(res, {
      level_stats: levelStats,
      category_stats: categoryStats,
      today_count: todayCount[0]?.count || 0,
      total_count: totalCount[0]?.count || 0,
      recent_errors: recentErrors[0]?.count || 0
    });
  } catch (err) {
    logger.error(`[系统日志] 统计失败: ${err.message}`);
    return error(res, '查询统计失败', 500);
  }
});

export default router;
