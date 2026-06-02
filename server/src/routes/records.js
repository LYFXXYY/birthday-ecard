import express from 'express';
import { Op } from 'sequelize';
import { success, error } from '../utils/response.js';
import { SendRecord, Employee, Template } from '../models/index.js';
import { authMiddleware } from '../middlewares/auth.js';
import { matchTemplate } from '../services/templateMatcher.js';
import { generateCard } from '../services/cardGenerator.js';
import { sendSMS } from '../services/smsService.js';

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

// 手动测试发送（完整流程：匹配模板 -> 生成贺卡 -> 发送短信 -> 创建记录）
router.post('/test-send/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // 检查员工是否存在
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return error(res, '员工不存在', 404);
    }
    
    // 1. 匹配模板
    const template = await matchTemplate(employee);
    if (!template) {
      return error(res, '没有可用的模板', 400);
    }

    // 2. 生成贺卡
    const cardResult = await generateCard(template, employee);

    // 3. 创建待发送记录
    const record = await SendRecord.create({
      employee_id: employee.id,
      template_id: template.id,
      card_url: cardResult.cardUrl,
      card_id: cardResult.cardId,
      send_status: 'pending',
      send_time: new Date(),
      admin_id: req.user.id
    });

    // 4. 发送短信
    const smsResult = await sendSMS(employee.phone, cardResult.cardUrl, employee.name);

    // 5. 更新记录
    await record.update({
      send_status: smsResult.success ? 'success' : 'failed',
      message_id: smsResult.messageId,
      sms_provider: smsResult.provider,
      retry_count: smsResult.retryCount,
      error_message: smsResult.error || null,
      send_time: new Date()
    });

    success(res, {
      employee: employee.name,
      template: template.name,
      cardUrl: cardResult.cardUrl,
      smsStatus: smsResult.success ? 'success' : 'failed',
      smsProvider: smsResult.provider,
      messageId: smsResult.messageId,
      smsError: smsResult.error || null
    }, smsResult.success ? '测试发送成功' : '贺卡生成成功，短信发送失败');
  } catch (err) {
    error(res, err.message);
  }
});

export default router;