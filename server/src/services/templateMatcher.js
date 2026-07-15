// 模板匹配服务（阶段八：按优先级匹配）
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
 * 匹配优先级（从高到低）：
 *   1. 手动指定的 default_template_id（员工 individually 设定的模板）
 *   2. 职级匹配：根据员工 level 确定 page_count，从匹配模板中随机选取
 *   3. 通用模板兜底：employee_level 为 'all' 或 null 的模板
 *
 * @param {object} employee - 员工对象
 * @param {object[]|null} [preloadedTemplates] - 预加载的模板列表
 */
export const matchTemplate = async (employee, preloadedTemplates = null) => {
  // 获取所有启用模板
  const templates = preloadedTemplates || await Template.findAll({
    where: { is_active: true },
    include: [{ model: Blessing, as: 'default_blessing' }]
  });

  if (templates.length === 0) return null;

  // 优先级 1：手动指定的模板
  if (employee.default_template_id) {
    let manualTemplate;
    if (preloadedTemplates) {
      manualTemplate = preloadedTemplates.find(t => t.id === employee.default_template_id);
    }
    if (!manualTemplate) {
      manualTemplate = await Template.findByPk(employee.default_template_id, {
        include: [{ model: Blessing, as: 'default_blessing' }]
      });
    }
    if (manualTemplate && manualTemplate.is_active) {
      logger.info(`[模板匹配] 员工 ${employee.name} → 使用手动指定模板「${manualTemplate.name}」`);
      return manualTemplate;
    }
  }

  // 优先级 2：职级匹配（按 page_count）
  const targetPageCount = LEVEL_PAGE_COUNT[employee.level] || 4;
  const levelMatched = templates.filter(t => t.page_count === targetPageCount);

  if (levelMatched.length > 0) {
    const selected = levelMatched[Math.floor(Math.random() * levelMatched.length)];
    logger.info(`[模板匹配] 员工 ${employee.name}（等级: ${employee.level}）→ 按页数 ${targetPageCount} 匹配到模板「${selected.name}」`);
    return selected;
  }

  // 优先级 3：通用模板兜底（employee_level 为 'all' 或 null）
  const genericTemplates = templates.filter(t =>
    t.employee_level === 'all' || t.employee_level === null
  );

  if (genericTemplates.length > 0) {
    const selected = genericTemplates[Math.floor(Math.random() * genericTemplates.length)];
    logger.info(`[模板匹配] 员工 ${employee.name} → 通用模板兜底「${selected.name}」`);
    return selected;
  }

  // 最终兜底：返回任意启用模板
  const selected = templates[Math.floor(Math.random() * templates.length)];
  logger.info(`[模板匹配] 员工 ${employee.name} → 最终兜底选取模板「${selected.name}」`);
  return selected;
};
