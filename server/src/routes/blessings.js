import { Router } from 'express';
import { literal } from 'sequelize';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { Blessing, Template } from '../models/index.js';
import { logOperation, extractLogInfo } from '../middlewares/operationLog.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('blessing');

const router = Router();

router.use(authMiddleware);

const BLESSING_FIELDS = [
  'content',
  'match_gender',
  'match_age_min',
  'match_age_max',
  'match_employee_level',
  'is_active'
];

const sanitizeInput = (obj) => {
  const sanitized = {};
  for (const key of BLESSING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

// GET /api/blessings - 祝福语列表
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.is_active !== undefined) {
      where.is_active = req.query.is_active === '1' || req.query.is_active === 'true';
    }
    const blessings = await Blessing.findAll({
      where,
      order: [['created_at', 'DESC']],
      attributes: {
        include: [
          [literal('(SELECT COUNT(*) FROM `templates` WHERE `templates`.`default_blessing_id` = `Blessing`.`id`)'), 'template_count']
        ]
      }
    });

    const blessingsWithCount = blessings.map(b => ({
      ...b.toJSON(),
      template_count: parseInt(b.get('template_count')) || 0
    }));

    success(res, blessingsWithCount);
  } catch (err) {
    logger.error('[祝福语列表] 查询异常:', err.message);
    error(res, '操作失败，请稍后重试');
  }
});

// GET /api/blessings/:id - 祝福语详情
router.get('/:id', async (req, res) => {
  try {
    const blessing = await Blessing.findByPk(req.params.id);
    if (!blessing) {
      return error(res, '祝福语不存在', 404);
    }
    success(res, blessing);
  } catch (err) {
    logger.error('[祝福语详情] 查询异常:', err.message);
    error(res, '操作失败，请稍后重试');
  }
});

// POST /api/blessings - 新增祝福语
router.post('/', async (req, res) => {
  try {
    const blessing = await Blessing.create(sanitizeInput(req.body));
    logOperation({ ...extractLogInfo(req), action: 'create', model: 'Blessing', model_id: blessing.id, details: { content: blessing.content?.substring(0, 50) } }).catch(console.error);
    success(res, blessing, '添加成功');
  } catch (err) {
    logger.error('[新增祝福语] 异常:', err.message);
    error(res, '操作失败，请稍后重试');
  }
});

// PUT /api/blessings/:id - 修改祝福语
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Blessing.update(
      sanitizeInput(req.body),
      { where: { id: req.params.id } }
    );
    if (!updated) {
      return error(res, '祝福语不存在', 404);
    }
    logOperation({ ...extractLogInfo(req), action: 'update', model: 'Blessing', model_id: parseInt(req.params.id) }).catch(console.error);
    success(res, null, '修改成功');
  } catch (err) {
    logger.error('[修改祝福语] 异常:', err.message);
    error(res, '操作失败，请稍后重试');
  }
});

// DELETE /api/blessings/:id - 删除祝福语
router.delete('/:id', async (req, res) => {
  try {
    // 检查是否有模板引用此祝福语
    const refCount = await Template.count({ where: { default_blessing_id: req.params.id } });
    if (refCount > 0) {
      // 解除模板关联
      await Template.update({ default_blessing_id: null }, { where: { default_blessing_id: req.params.id } });
      logger.info(`[祝福语] 已解除 ${refCount} 个模板的默认祝福语关联`);
    }

    // 查询祝福语内容用于操作日志
    const blessing = await Blessing.findByPk(req.params.id);

    const deleted = await Blessing.destroy({ where: { id: req.params.id } });
    if (!deleted) {
      return error(res, '祝福语不存在', 404);
    }
    logOperation({ ...extractLogInfo(req), action: 'delete', model: 'Blessing', model_id: parseInt(req.params.id) }).catch(console.error);
    success(res, null, refCount > 0 ? `删除成功，已解除 ${refCount} 个模板的关联` : '删除成功');
  } catch (err) {
    logger.error('[删除祝福语] 异常:', err.message);
    error(res, '操作失败，请稍后重试');
  }
});

export default router;
