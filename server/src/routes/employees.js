import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { sequelize, Employee, Template, Blessing, SendRecord } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { parseEmployeeExcel, validateEmployee } from '../utils/excelParser.js';
import { Op } from 'sequelize';
import { generateCard } from '../services/cardGenerator.js';
import { sendSMS } from '../services/smsService.js';

const router = Router();

// 所有员工路由需要认证
router.use(authMiddleware);

// 配置文件上传
const upload = multer({
  dest: '../uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel和CSV文件'));
    }
  }
});

/**
 * 白名单过滤：防止mass assignment攻击
 */
const EMPLOYEE_FIELDS = ['name', 'gender', 'birthday', 'phone', 'department', 'position', 'defaultTemplateId', 'default_template_id'];

const sanitizeEmployeeInput = (obj) => {
  const sanitized = {};
  for (const key of EMPLOYEE_FIELDS) {
    if (obj.hasOwnProperty(key)) {
      // 统一转换为 snake_case 数据库字段名
      let dbKey = key;
      if (key === 'defaultTemplateId') dbKey = 'default_template_id';
      sanitized[dbKey] = obj[key];
    }
  }
  return sanitized;
};

// GET /api/employees - 获取员工列表（分页、搜索）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword, department } = req.query;
    const offset = (page - 1) * pageSize;

    const where = { is_active: true };
    
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { phone: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (department) {
      where.department = department;
    }

    const { count, rows } = await Employee.findAndCountAll({
      where,
      offset: parseInt(offset),
      limit: parseInt(pageSize),
      order: [['created_at', 'DESC']],
      include: [{
        model: Template,
        as: 'default_template',
        attributes: ['id', 'name']
      }]
    });

    // 简化返回数据
    const list = rows.map(emp => ({
      id: emp.id,
      name: emp.name,
      gender: emp.gender,
      birthday: emp.birthday,
      phone: emp.phone,
      department: emp.department,
      position: emp.position,
      defaultTemplateName: emp.default_template?.name || null
    }));

    success(res, {
      list,
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/employees/today-birthday - 获取今天生日的员工（必须在 /:id 之前定义）
router.get('/today-birthday', async (req, res) => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const employees = await Employee.findAll({
      where: {
        is_active: true,
        [Op.and]: [
          sequelize.where(sequelize.fn('MONTH', sequelize.col('birthday')), month),
          sequelize.where(sequelize.fn('DAY', sequelize.col('birthday')), day)
        ]
      },
      include: [{
        model: Template,
        as: 'default_template',
        attributes: ['id', 'name']
      }]
    });

    success(res, employees);
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/employees/:id - 获取单个员工详情
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      include: [{
        model: Template,
        as: 'default_template'
      }]
    });

    if (!employee) {
      return error(res, '员工不存在', 404);
    }

    success(res, employee);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/employees - 新增员工
router.post('/', async (req, res) => {
  try {
    const employee = await Employee.create(sanitizeEmployeeInput(req.body));
    success(res, employee, '添加成功');
  } catch (err) {
    error(res, err.message);
  }
});

// PUT /api/employees/:id - 修改员工
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Employee.update(
      sanitizeEmployeeInput(req.body),
      { where: { id: req.params.id } }
    );

    if (!updated) {
      return error(res, '员工不存在', 404);
    }

    success(res, null, '修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

// DELETE /api/employees/:id - 删除员工（软删除）
router.delete('/:id', async (req, res) => {
  try {
    const [updated] = await Employee.update(
      { is_active: false },
      { where: { id: req.params.id } }
    );

    if (!updated) {
      return error(res, '员工不存在', 404);
    }

    success(res, null, '删除成功');
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/employees/:id/generate-card - 手动生成员工贺卡并发送短信
router.post('/:id/generate-card', async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      include: [{ model: Template, as: 'default_template', include: [{ model: Blessing, as: 'default_blessing' }] }]
    });

    if (!employee) {
      return error(res, '员工不存在', 404);
    }

    // 获取模板（优先使用员工指定的模板，否则用通用模板）
    const template = employee.default_template || await Template.findOne({ where: { match_gender: 'all' } });
    if (!template) {
      return error(res, '没有可用的模板', 400);
    }

    const cardResult = await generateCard(template, employee);
    
    // 创建待发送记录（先建记录再发短信，保证崩溃时也有据可查）
    const record = await SendRecord.create({
      employee_id: employee.id,
      template_id: template.id,
      card_url: cardResult.cardUrl,
      card_id: cardResult.cardId,
      send_status: 'pending',
      send_time: new Date(),
      admin_id: req.user.id
    });

    // 发送短信
    const smsResult = await sendSMS(employee.phone, cardResult.cardUrl, employee.name);

    // 根据短信结果更新记录
    await record.update({
      send_status: smsResult.success ? 'success' : 'failed',
      message_id: smsResult.messageId,
      sms_provider: smsResult.provider,
      retry_count: smsResult.retryCount,
      error_message: smsResult.error || null,
      send_time: new Date()
    });

    success(res, {
      cardUrl: cardResult.cardUrl,
      cardId: cardResult.cardId,
      smsStatus: smsResult.success ? 'success' : 'failed',
      smsProvider: smsResult.provider,
      smsError: smsResult.error || null
    }, smsResult.success ? '贺卡生成并发送成功' : '贺卡生成成功，短信发送失败');
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/employees/import - Excel批量导入
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return error(res, '请上传Excel文件', 400);
    }

    const employees = parseEmployeeExcel(req.file.path);
    const errors = [];

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      const validationErrors = validateEmployee(emp);
      
      if (validationErrors.length > 0) {
        errors.push({ row: i + 2, reason: validationErrors.join('; ') });
      }
    }

    if (errors.length > 0) {
      await fs.unlink(req.file.path);
      return error(res, `部分数据验证失败`, 400, {
        total: employees.length,
        valid: employees.length - errors.length,
        errors
      });
    }

    // 批量插入
    const result = await Employee.bulkCreate(
      employees,
      { validate: true, ignoreDuplicates: true }
    );

    // 删除临时文件
    await fs.unlink(req.file.path);

    success(res, {
      total: employees.length,
      imported: result.length
    }, `成功导入 ${result.length} 条数据`);
  } catch (err) {
    // 出错也删除临时文件
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch {}
    }
    error(res, `导入失败: ${err.message}`);
  }
});

export default router;
