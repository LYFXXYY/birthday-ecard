// 定时任务服务
import cron from 'node-cron';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Employee, SendRecord } from '../models/index.js';
import { matchTemplate } from './templateMatcher.js';
import { generateCard } from './cardGenerator.js';
import { sendSMS } from './smsService.js';

/**
 * 启动生日定时任务
 */
export const startBirthdayScheduler = () => {
  // 每天早上8点执行
  cron.schedule('0 8 * * *', async () => {
    console.log('[定时任务] 开始检查今日生日员工...');
    
    try {
      await processBirthdayEmployees();
      console.log('[定时任务] 生日贺卡发送完成');
    } catch (err) {
      console.error('[定时任务] 执行失败:', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  console.log('[定时任务] 已启动生日检查定时任务');
};

/**
 * 处理今日生日员工（独立函数，便于复用和测试）
 * 
 * 流程：匹配模板 -> 生成贺卡 -> 创建待发送记录 -> 发送短信 -> 更新记录状态
 * 先创建 pending 记录再发送短信，确保即使进程崩溃也有记录可查
 */
export const processBirthdayEmployees = async () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // 1. 查询今天生日的员工
  const birthdayEmployees = await Employee.findAll({
    where: {
      is_active: true,
      [Op.and]: [
        sequelize.where(sequelize.fn('MONTH', sequelize.col('birthday')), month),
        sequelize.where(sequelize.fn('DAY', sequelize.col('birthday')), day)
      ]
    }
  });

  console.log(`[定时任务] 找到 ${birthdayEmployees.length} 位今日生日员工`);

  // 2. 查询今天已成功发送的员工ID集合（防重复发送）
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const alreadySent = await SendRecord.findAll({
    where: {
      send_status: 'success',
      send_time: { [Op.gte]: todayStart, [Op.lt]: todayEnd }
    },
    attributes: ['employee_id']
  });
  const sentEmployeeIds = new Set(alreadySent.map(r => r.employee_id));

  // 3. 逐个处理
  for (const employee of birthdayEmployees) {
    if (sentEmployeeIds.has(employee.id)) {
      console.log(`[定时任务] 员工 ${employee.name} 今日已发送，跳过`);
      continue;
    }

    let record = null;
    try {
      // 3.1 匹配模板
      const template = await matchTemplate(employee);
      if (!template) {
        throw new Error('无可用模板');
      }
      
      // 3.2 生成贺卡
      const cardResult = await generateCard(template, employee);

      // 3.3 创建待发送记录（先建记录再发短信，保证崩溃时也有据可查）
      record = await SendRecord.create({
        employee_id: employee.id,
        template_id: template.id,
        card_url: cardResult.cardUrl,
        card_id: cardResult.cardId,
        send_status: 'pending',
        send_time: new Date()
      });

      // 3.4 发送短信/彩信
      const smsResult = await sendSMS(employee.phone, cardResult.cardUrl, employee.name);

      // 3.5 根据短信发送结果更新记录状态
      await record.update({
        send_status: smsResult.success ? 'success' : 'failed',
        message_id: smsResult.messageId,
        sms_provider: smsResult.provider,
        retry_count: smsResult.retryCount,
        error_message: smsResult.error || null,
        send_time: new Date()
      });

      if (smsResult.success) {
        console.log(`[定时任务] 已为员工 ${employee.name} 生成贺卡并发送短信 (${smsResult.provider})`);
      } else {
        console.warn(`[定时任务] 员工 ${employee.name} 贺卡已生成但短信发送失败: ${smsResult.error}`);
      }

    } catch (err) {
      // 更新已有的 pending 记录为失败状态
      if (record) {
        await record.update({
          send_status: 'failed',
          error_message: err.message
        }).catch(updateErr => console.error('[定时任务] 更新失败记录出错:', updateErr.message));
      }
      console.error(`[定时任务] 处理员工 ${employee.name} 失败:`, err.message);
    }
  }
};
