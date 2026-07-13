/**
 * 自动匹配服务 - 为新模板/新员工自动分配通用祝福语/模板
 *
 * 规则：
 *   - 通用祝福语 = Blessing.match_employee_level 匹配 && is_active === true
 *   - 通用模板   = Template.employee_level 匹配 && is_active === true
 *   - 随机选取：从符合条件的记录中随机取 1 条
 */
import { Op } from 'sequelize';
import { Blessing, Template } from '../models/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('autoMatch');

/**
 * 随机选取一条匹配职级的祝福语
 * @param {string|null} [employeeLevel] - 员工等级（management/manager/employee）
 * @returns {Promise<Blessing|null>}
 */
export const pickRandomUniversalBlessing = async (employeeLevel = null) => {
  const where = { is_active: true };

  if (employeeLevel) {
    // 匹配该职级 + 通用(all) 的祝福语
    where[Op.or] = [
      { match_employee_level: employeeLevel },
      { match_employee_level: 'all' },
      { match_employee_level: null }
    ];
  } else {
    // 无指定职级时，取通用祝福语
    where[Op.or] = [
      { match_employee_level: 'all' },
      { match_employee_level: null }
    ];
  }

  const blessings = await Blessing.findAll({ where });
  if (blessings.length === 0) return null;
  return blessings[Math.floor(Math.random() * blessings.length)];
};

/**
 * 随机选取一个匹配职级的模板
 * @param {string} [employeeLevel] - 员工等级，优先选取匹配该等级的模板
 * @returns {Promise<Template|null>}
 */
export const pickRandomUniversalTemplate = async (employeeLevel = null) => {
  const where = { is_active: true };
  // 如果有员工等级，优先找匹配该等级的模板
  if (employeeLevel) {
    where[Op.or] = [
      { employee_level: employeeLevel },
      { employee_level: 'all' },
      { employee_level: null }
    ];
  }
  const templates = await Template.findAll({
    where,
    attributes: ['id', 'name', 'employee_level']
  });
  if (templates.length === 0) {
    // 降级：不带等级条件再找一次
    if (employeeLevel) return pickRandomUniversalTemplate(null);
    return null;
  }
  return templates[Math.floor(Math.random() * templates.length)];
};

/**
 * 为新模板自动分配祝福语（若未手动指定）
 * 调用方在 Template.create() 之后执行
 * @param {Template} template - 刚创建的模板实例
 * @returns {Promise<Template>} 更新后的模板实例
 */
export const autoAssignBlessingToTemplate = async (template) => {
  if (template.default_blessing_id) return template; // 已手动指定

  const blessing = await pickRandomUniversalBlessing(template.employee_level);
  if (blessing) {
    await template.update({ default_blessing_id: blessing.id });
    logger.info(`[自动匹配] 模板 #${template.id}「${template.name}」→ 祝福语 #${blessing.id}`);
  } else {
    logger.warn('[自动匹配] 无可用通用祝福语，跳过分配');
  }
  return template;
};

/**
 * 为新员工自动分配模板（若未手动指定）
 * @param {Employee} employee - 刚创建的员工实例
 * @returns {Promise<Employee>} 更新后的员工实例
 */
export const autoAssignTemplateToEmployee = async (employee) => {
  if (employee.default_template_id) return employee; // 已手动指定

  const template = await pickRandomUniversalTemplate(employee.level);
  if (template) {
    await employee.update({ default_template_id: template.id });
    logger.info(`[自动匹配] 员工 #${employee.id}「${employee.name}」→ 模板 #${template.id}「${template.name}」`);
  } else {
    logger.warn('[自动匹配] 无可用通用模板，跳过分配');
  }
  return employee;
};
