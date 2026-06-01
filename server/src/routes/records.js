import express from 'express';
import { Op } from 'sequelize';
import { success, error } from '../utils/response.js';
import { SendRecord, Employee, Template } from '../models/index.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// 所有记录路由需要认证
router.use(authMiddleware);

// 获取发送记录列表（分页、筛选）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, employeeId, status, startDate, endDate } = req.query;
    const offset = (page - 1) * pageSize;
    
    const where = {};
    
    // 筛选条件
    if (employeeId) where.employee_id = employeeId;
    if (status) where.send_status = status;
    if (startDate || endDate) {
      where.send_time = {};
      if (startDate) where.send_time[Op.gte] = new Date(startDate);
      if (endDate) where.send_time[Op.lte] = new Date(endDate);
    }
    
    const { count, rows } = await SendRecord.findAndCountAll({
      where,
      include: [{
        model: Employee,
        as: 'employee',
        attributes: ['name', 'department', 'phone']
      }, {
        model: Template,
        as: 'template',
        attributes: ['name']
      }],
      order: [['created_at', 'DESC']],
      offset,
      limit: parseInt(pageSize)
    });
    
    success(res, {
      list: rows,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    error(res, err.message);
  }
});

// 获取统计数据
router.get('/stats', async (req, res) => {
  try {
    const total = await SendRecord.count();
    const successCount = await SendRecord.count({ where: { send_status: 'success' } });
    const failedCount = await SendRecord.count({ where: { send_status: 'failed' } });
    
    success(res, {
      total,
      success: successCount,
      failed: failedCount,
      success_rate: total ? parseFloat(((successCount / total) * 100).toFixed(2)) : 0
    });
  } catch (err) {
    error(res, err.message);
  }
});

// 手动测试发送（开发调试用）
router.post('/test-send/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // 检查员工是否存在
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return error(res, '员工不存在', 404);
    }
    
    // 模拟测试发送（实际项目中会调用真实发送逻辑）
    success(res, {
      employeeId,
      message: '测试发送成功（模拟）',
      status: 'success'
    });
  } catch (err) {
    error(res, err.message);
  }
});

export default router;