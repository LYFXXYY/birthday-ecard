// 模板匹配服务
import { Template, Blessing } from '../models/index.js';

/**
 * 根据员工信息匹配最佳模板
 * 匹配优先级：手动指定 > 性别+年龄 > 性别 > 通用模板
 * 
 * @param {object} employee - 员工对象
 * @param {object[]|null} [preloadedTemplates] - 预加载的模板列表（避免 N+1 查询）
 */
export const matchTemplate = async (employee, preloadedTemplates = null) => {
  // 1. 如果员工有手动指定的模板，直接使用
  if (employee.default_template_id) {
    // 如果预加载列表中有该模板，直接从中取（避免额外查询）
    if (preloadedTemplates) {
      const found = preloadedTemplates.find(t => t.id === employee.default_template_id);
      if (found) return found;
    }
    return await Template.findByPk(employee.default_template_id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });
  }

  // 2. 计算员工年龄（安全处理 birthday 为空的情况）
  let age = null;
  if (employee.birthday) {
    const birthDate = new Date(employee.birthday);
    if (!isNaN(birthDate.getTime())) {
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }
  }
  if (age === null) {
    console.warn(`[模板匹配] 员工 ${employee.name}（ID:${employee.id}）的 birthday 为空或无效，跳过年龄匹配`);
  }

  // 3. 获取模板列表（优先使用预加载数据，避免 N+1 查询）
  const templates = preloadedTemplates || await Template.findAll({
    where: { is_active: true },
    include: [{ model: Blessing, as: 'default_blessing' }]
  });

  // 按性别匹配度排序：具体性别优先于 'all'
  const sortedTemplates = templates.sort((a, b) => {
    const aMatch = a.match_gender === employee.gender ? 0 : (a.match_gender === 'all' ? 1 : 2);
    const bMatch = b.match_gender === employee.gender ? 0 : (b.match_gender === 'all' ? 1 : 2);
    return aMatch - bMatch;
  });

  // 精确匹配：性别 + 年龄段（仅在 age 有效时尝试）
  if (age !== null) {
    const exactMatch = sortedTemplates.find(t =>
      (t.match_gender === employee.gender || t.match_gender === 'all') &&
      (!t.match_age_min || age >= t.match_age_min) &&
      (!t.match_age_max || age <= t.match_age_max)
    );
    if (exactMatch) return exactMatch;
  }

  // 宽松匹配：仅性别
  const genderMatch = sortedTemplates.find(t =>
    t.match_gender === employee.gender || t.match_gender === 'all'
  );
  if (genderMatch) return genderMatch;

  // 兜底：返回第一个启用的通用模板
  return sortedTemplates.find(t => t.match_gender === 'all') || sortedTemplates[0];
};