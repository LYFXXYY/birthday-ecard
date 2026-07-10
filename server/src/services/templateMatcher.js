// 模板匹配服务（阶段八：按 level→page_count 优先匹配）
import { Template, Blessing } from '../models/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('autoMatch');

/**
 * 员工等级 → 对应页数映射
 * management / manager → 7页，employee → 4页
 */
const LEVEL_PAGE_COUNT = {
  management: 7,
  manager: 7,
  employee: 4
};

/**
 * 根据员工信息匹配模板
 *
 * 匹配优先级：
 *   1. 根据员工 level 确定 page_count，从匹配模板集中随机选取
 *   2. 手动指定的 default_template_id 作为兜底
 *   3. 最终兜底：返回任意启用模板
 *
 * @param {object} employee - 员工对象
 * @param {object[]|null} [preloadedTemplates] - 预加载的模板列表
 */
export const matchTemplate = async (employee, preloadedTemplates = null) => {
  // 1. 获取所有启用模板
  const templates = preloadedTemplates || await Template.findAll({
    where: { is_active: true },
    include: [{ model: Blessing, as: 'default_blessing' }]
  });

  if (templates.length === 0) return null;

  // 2. 根据等级确定目标页数，优先匹配
  const targetPageCount = LEVEL_PAGE_COUNT[employee.level] || 4;
  const matched = templates.filter(t => t.page_count === targetPageCount);

  if (matched.length > 0) {
    const randomIndex = Math.floor(Math.random() * matched.length);
    const selected = matched[randomIndex];
    logger.info(`[模板匹配] 员工 ${employee.name}（等级: ${employee.level}）→ 按页数 ${targetPageCount} 匹配到模板「${selected.name}」`);
    return selected;
  }

  // 3. 无页数匹配时，尝试使用手动指定的模板
  if (employee.default_template_id) {
    if (preloadedTemplates) {
      const found = preloadedTemplates.find(t => t.id === employee.default_template_id);
      if (found) {
        logger.info(`[模板匹配] 员工 ${employee.name} → 无页数匹配，使用指定模板「${found.name}」`);
        return found;
      }
    }
    const fallback = await Template.findByPk(employee.default_template_id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });
    if (fallback) {
      logger.info(`[模板匹配] 员工 ${employee.name} → 无页数匹配，使用指定模板「${fallback.name}」`);
      return fallback;
    }
  }

  // 4. 最终兜底：返回任意启用模板
  const randomIndex = Math.floor(Math.random() * templates.length);
  const selected = templates[randomIndex];
  logger.info(`[模板匹配] 员工 ${employee.name} → 兜底选取模板「${selected.name}」`);
  return selected;
};
