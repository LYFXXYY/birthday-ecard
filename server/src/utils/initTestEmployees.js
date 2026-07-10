/**
 * 初始化测试员工
 * 
 * 添加几个生日为明天（7月11日）的测试员工，用于验证自动发送流程。
 * 仅在 employees 表为空时添加，避免重复创建。
 */
import { Employee } from '../models/index.js';
import { getLogger } from './logger.js';

const logger = getLogger('init');

// 测试员工数据：生日为 7 月 11 日（年份不影响月份/日期匹配）
const TEST_EMPLOYEES = [
  {
    name: '张三（测试）',
    gender: 'male',
    birthday: '1990-07-11',
    phone: '13800000001',
    department: '技术部',
    level: 'employee',
    position: '前端开发工程师'
  },
  {
    name: '李四（测试）',
    gender: 'female',
    birthday: '1988-07-11',
    phone: '13800000002',
    department: '产品部',
    level: 'employee',
    position: '产品经理'
  },
  {
    name: '王五（测试）',
    gender: 'male',
    birthday: '1985-07-11',
    phone: '13800000003',
    department: '市场部',
    level: 'manager',
    position: '三级经理'
  }
];

/**
 * 初始化测试员工（仅当表为空时）
 */
export const initTestEmployees = async () => {
  const count = await Employee.count();
  
  if (count > 0) {
    logger.info(`[初始化] 员工表已有 ${count} 条记录，跳过测试员工初始化`);
    return;
  }

  logger.info('[初始化] 员工表为空，开始添加测试员工...');

  for (const emp of TEST_EMPLOYEES) {
    await Employee.create(emp);
    logger.info(`[初始化] 已创建测试员工: ${emp.name}（生日: ${emp.birthday}）`);
  }

  logger.info(`[初始化] 已创建 ${TEST_EMPLOYEES.length} 名测试员工（生日均为7月11日）`);
};
