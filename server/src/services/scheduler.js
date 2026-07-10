// 定时任务服务
import cron from 'node-cron';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Employee, SendRecord, Template, Blessing, OperationLog } from '../models/index.js';
import { sendBirthdayCard } from './sendService.js';
import { updateSenderHeartbeat, updateMonitorHeartbeat, getSenderHeartbeat, initSenderHeartbeat } from './heartbeatService.js';
import { cleanupExpiredSessions } from './sessionService.js';
import { config } from '../config/index.js';
import { getLogger } from '../utils/logger.js';
import { logInfo, logWarn, logError } from '../utils/systemLogWriter.js';

const logger = getLogger('scheduler');

// 定时任务运行状态追踪（内存中维护，供监控页面展示）
const cronJobsStatus = new Map([
  ['birthday_send', { name: '生日贺卡发送', schedule: '每天 08:00', last_run: null, status: 'waiting', message: '等待首次执行' }],
  ['health_check', { name: '心跳监控', schedule: '每 30 秒', last_run: null, status: 'waiting', message: '等待首次执行' }],
  ['log_cleanup', { name: '日志清理', schedule: '每天 02:00', last_run: null, status: 'waiting', message: '等待首次执行' }],
  ['session_cleanup', { name: '会话清理', schedule: '每天 03:00', last_run: null, status: 'waiting', message: '等待首次执行' }]
]);

/**
 * 获取所有定时任务的运行状态
 */
export const getCronJobsStatus = () => {
  const result = {};
  for (const [key, val] of cronJobsStatus) {
    result[key] = { ...val };
  }
  return result;
};

/**
 * 更新定时任务状态
 */
const updateJobStatus = (key, status, message = '') => {
  const job = cronJobsStatus.get(key);
  if (job) {
    job.last_run = new Date().toISOString();
    job.status = status;
    job.message = message;
  }
};

/**
 * 启动所有定时任务
 */
export const startBirthdayScheduler = async () => {
  // 初始化发送服务心跳（避免首次启动时显示 unhealthy）
  await initSenderHeartbeat();

  // ========== 1. 每天早上8点：处理生日员工 ==========
  cron.schedule('0 8 * * *', async () => {
    logger.info('[定时任务] 开始检查今日生日员工...');
    updateJobStatus('birthday_send', 'running', '正在处理今日生日员工');
    await logInfo('scheduler', '开始执行每日生日贺卡发送任务');
    
    try {
      await processBirthdayEmployees();
      // 发送成功后更新心跳
      await updateSenderHeartbeat();
      logger.info('[定时任务] 生日贺卡发送完成，心跳已更新');
      updateJobStatus('birthday_send', 'success', '生日贺卡发送完成');
      await logInfo('scheduler', '生日贺卡发送任务完成');
    } catch (err) {
      logger.error(`[定时任务] 执行失败: ${err.message}`);
      updateJobStatus('birthday_send', 'error', err.message);
      await logError('scheduler', `生日贺卡发送任务失败: ${err.message}`);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // ========== 2. 每30秒：监控服务检查发送服务心跳 ==========
  cron.schedule('*/30 * * * * *', async () => {
    try {
      await updateMonitorHeartbeat();
      updateJobStatus('health_check', 'running', '检查发送服务心跳');

      const lastBeat = await getSenderHeartbeat();
      if (!lastBeat) {
        // 还没有心跳记录，可能还没执行过发送任务，忽略
        updateJobStatus('health_check', 'success', '暂无心跳记录（正常）');
        return;
      }

      const beatTime = new Date(lastBeat);
      const now = new Date();
      const hoursSinceBeat = (now - beatTime) / (1000 * 60 * 60);

      if (hoursSinceBeat > 25) {
        logger.warn(
          `[监控警告] 发送服务心跳已超过 ${hoursSinceBeat.toFixed(1)} 小时未更新！` +
          `最后心跳时间: ${lastBeat}`
        );
        updateJobStatus('health_check', 'warning', `心跳超时 ${hoursSinceBeat.toFixed(1)} 小时`);
        await logWarn('heartbeat', `发送服务心跳超时: ${hoursSinceBeat.toFixed(1)}小时未更新`, { lastBeat });
      } else {
        updateJobStatus('health_check', 'success', `心跳正常（${hoursSinceBeat.toFixed(1)}小时前）`);
      }
    } catch (err) {
      logger.error(`[监控] 心跳检查失败: ${err.message}`);
      updateJobStatus('health_check', 'error', err.message);
    }
  });

  // ========== 3. 每天凌晨2点：清理过期操作日志 ==========
  cron.schedule('0 2 * * *', async () => {
    logger.info('[定时任务] 开始清理过期操作日志...');
    updateJobStatus('log_cleanup', 'running', '正在清理过期日志');
    try {
      const retentionDays = config.logRetentionDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deleted = await OperationLog.destroy({
        where: {
          created_at: { [Op.lt]: cutoffDate }
        }
      });

      logger.info(`[定时任务] 已清理 ${deleted} 条超过 ${retentionDays} 天的操作日志`);
      updateJobStatus('log_cleanup', 'success', `已清理 ${deleted} 条日志`);
    } catch (err) {
      logger.error(`[定时任务] 日志清理失败: ${err.message}`);
      updateJobStatus('log_cleanup', 'error', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // ========== 4. 每天凌晨3点：清理过期会话 ==========
  cron.schedule('0 3 * * *', async () => {
    logger.info('[定时任务] 开始清理过期会话...');
    updateJobStatus('session_cleanup', 'running', '正在清理过期会话');
    try {
      await cleanupExpiredSessions();
      logger.info('[定时任务] 过期会话清理完成');
      updateJobStatus('session_cleanup', 'success', '过期会话清理完成');
    } catch (err) {
      logger.error(`[定时任务] 会话清理失败: ${err.message}`);
      updateJobStatus('session_cleanup', 'error', err.message);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // ========== 5. 启动补发：如果当前时间已过 8:00，立即执行今日生日检查 ==========
  const now = new Date();
  const shanghaiHour = parseInt(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false, timeZone: 'Asia/Shanghai'
  }).format(now));

  if (shanghaiHour >= 8) {
    logger.info('[启动补发] 当前时间已过 08:00，立即执行今日生日检查...');
    updateJobStatus('birthday_send', 'running', '启动补发：正在处理今日生日员工');
    await logInfo('scheduler', '启动补发：服务启动时间晚于 08:00，立即执行生日贺卡发送');

    try {
      await processBirthdayEmployees();
      await updateSenderHeartbeat();
      updateJobStatus('birthday_send', 'success', '启动补发完成');
      logger.info('[启动补发] 生日贺卡发送完成');
      await logInfo('scheduler', '启动补发任务完成');
    } catch (err) {
      logger.error(`[启动补发] 执行失败: ${err.message}`);
      updateJobStatus('birthday_send', 'error', err.message);
      await logError('scheduler', `启动补发失败: ${err.message}`);
    }
  } else {
    logger.info(`[启动补发] 当前时间 ${shanghaiHour}:00，等待 08:00 定时任务触发`);
  }

  logger.info('[定时任务] 已启动所有定时任务（生日检查/监控/日志清理/会话清理）');
};

/**
 * 处理今日生日员工
 * 
 * 流程：查询今日生日员工 -> 逐个调用共享发送服务
 * 发送服务内部已包含：匹配模板 → 生成贺卡 → 创建记录 → 发送短信（含重试） → 更新状态
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

  logger.info(`[定时任务] 找到 ${birthdayEmployees.length} 位今日生日员工`);

  // 2. 预加载所有激活模板（避免循环内 N+1 查询）
  const preloadedTemplates = await Template.findAll({
    where: { is_active: true },
    include: [{
      model: Blessing,
      as: 'default_blessing'
    }]
  });

  // 3. 逐个处理（共享发送函数内部已包含重复发送检查）
  for (const employee of birthdayEmployees) {
    try {
      const result = await sendBirthdayCard({ employeeId: employee.id, skipIfSentToday: true, preloadedTemplates });

      if (result.error === '今日已发送，跳过') {
        logger.info(`[定时任务] 员工 ${employee.name} 今日已发送，跳过`);
        continue;
      }

      if (result.success) {
        logger.info(`[定时任务] 已为员工 ${employee.name} 生成贺卡并发送短信 (${result.smsProvider})`);
      } else {
        logger.warn(`[定时任务] 员工 ${employee.name} 发送失败: ${result.error}`);
      }
    } catch (err) {
      logger.error(`[定时任务] 处理员工 ${employee.name} 失败: ${err.message}`);
    }
  }
};
