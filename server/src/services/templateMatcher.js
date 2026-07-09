// 模板匹配服务（阶段八：简化为按 page_count + 随机选取）
import { Template, Blessing } from '../models/index.js';

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
 * 阶段八简化逻辑：
 *   1. 手动指定 default_template_id → 直接使用
 *   2. 根据员工 level 确定 page_count
 *   3. 从匹配模板集中随机选取一个
 *   4. 兜底：返回任意启用模板
 *
 * @param {object} employee - 员工对象
 * @param {object[]|null} [preloadedTemplates] - 预加载的模板列表
 */
export const matchTemplate = async (employee, preloadedTemplates = null) => {
  // 1. 手动指定模板优先
  if (employee.default_template_id) {
    if (preloadedTemplates) {
      const found = preloadedTemplates.find(t => t.id === employee.default_template_id);
      if (found) return found;
    }
    return await Template.findByPk(employee.default_template_id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });
  }

  // 2. 获取所有启用模板
  const templates = preloadedTemplates || await Template.findAll({
    where: { is_active: true },
    include: [{ model: Blessing, as: 'default_blessing' }]
  });

  if (templates.length === 0) return null;

  // 3. 根据等级确定目标页数
  const targetPageCount = LEVEL_PAGE_COUNT[employee.level] || 4;

  // 4. 筛选匹配页数的模板
  const matched = templates.filter(t => t.page_count === targetPageCount);

  // 5. 从匹配集中随机选取
  const pool = matched.length > 0 ? matched : templates;
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};
