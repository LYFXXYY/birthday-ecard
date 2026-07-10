/**
 * 监控服务 - 系统健康检查与统计
 * 
 * 提供系统各组件的健康状态检测和运行统计数据，
 * 供前端系统状态页面和 API 接口调用。
 */
import { Op, fn, col, literal } from 'sequelize';
import { sequelize, SendRecord, Employee } from '../models/index.js';
import { getSenderHeartbeat, getMonitorHeartbeat } from './heartbeatService.js';
import { getCronJobsStatus } from './scheduler.js';

// 心跳超时阈值：25 小时（发送服务每日 08:00 运行一次，需覆盖全天）
const HEARTBEAT_TIMEOUT_MS = 25 * 60 * 60 * 1000;

/**
 * 检查发送服务健康状态
 * @returns {Promise<'healthy'|'unhealthy'>}
 */
export const checkSenderHealth = async () => {
  const lastBeat = await getSenderHeartbeat();
  if (!lastBeat) {
    return 'unhealthy';
  }

  const beatTime = new Date(lastBeat);
  const now = new Date();
  const elapsed = now - beatTime;

  return elapsed <= HEARTBEAT_TIMEOUT_MS ? 'healthy' : 'unhealthy';
};

/**
 * 获取系统整体健康状态
 * @returns {Promise<{
 *   sender_service: string,
 *   monitor_service: string,
 *   database: string,
 *   last_heartbeat: string|null
 * }>}
 */
export const getSystemHealth = async () => {
  // 检查发送服务
  const senderStatus = await checkSenderHealth();
  const lastHeartbeat = await getSenderHeartbeat();

  // 检查数据库连接
  let dbStatus = 'disconnected';
  try {
    await sequelize.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  return {
    sender_service: senderStatus,
    monitor_service: 'healthy',  // 监控服务自身正在运行，所以是 healthy
    database: dbStatus,
    last_heartbeat: lastHeartbeat
  };
};

/**
 * 获取系统运行统计数据
 * @returns {Promise<object>}
 */
export const getSystemStats = async () => {
  // 1. 发送统计：总数、成功数、失败数、成功率
  const totalSends = await SendRecord.count();
  const successCount = await SendRecord.count({ where: { send_status: 'success' } });
  const failedCount = await SendRecord.count({ where: { send_status: 'failed' } });
  const successRate = totalSends > 0 ? Math.round((successCount / totalSends) * 10000) / 100 : 0;

  const send_stats = {
    total: totalSends,
    success: successCount,
    failed: failedCount,
    success_rate: successRate
  };

  // 2. 模板使用统计：按 template_name 分组计数
  const templateUsageRaw = await SendRecord.findAll({
    attributes: [
      'template_name',
      [fn('COUNT', '*'), 'count']
    ],
    where: {
      template_name: { [Op.ne]: null }
    },
    group: ['template_name'],
    raw: true
  });

  const template_usage = templateUsageRaw.map(row => ({
    template_name: row.template_name,
    count: parseInt(row.count)
  }));

  // 3. 今日发送数量
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const today_count = await SendRecord.count({
    where: {
      send_time: { [Op.gte]: todayStart, [Op.lte]: todayEnd }
    }
  });

  // 4. 按员工等级统计发送量（SendRecord 关联 Employee）
  const levelStatsRaw = await SendRecord.findAll({
    attributes: [
      [literal('`employee`.`level`'), 'level'],
      [fn('COUNT', '*'), 'count']
    ],
    include: [{
      model: Employee,
      as: 'employee',
      attributes: []
    }],
    group: [literal('`employee`.`level`')],
    raw: true
  });

  const level_stats = levelStatsRaw.map(row => ({
    level: row.level || 'unknown',
    count: parseInt(row.count)
  }));

  return {
    send_stats,
    template_usage,
    today_count,
    level_stats
  };
};

/**
 * 获取内存使用情况
 */
export const getMemoryUsage = () => {
  const mem = process.memoryUsage();
  const toMB = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;
  return {
    rss: toMB(mem.rss),
    heapUsed: toMB(mem.heapUsed),
    heapTotal: toMB(mem.heapTotal),
    external: toMB(mem.external),
    usagePercent: Math.round(mem.heapUsed / mem.heapTotal * 100)
  };
};

/**
 * 获取定时任务运行状态
 */
export const getCronStatus = () => {
  return getCronJobsStatus();
};

/**
 * 获取系统告警
 * 
 * 检查规则：
 * 1. 近 7 天发送失败率 > 30%
 * 2. 超过 3 天无成功发送记录
 * 3. 发送服务心跳超时
 */
export const getAlerts = async () => {
  const alerts = [];

  // 1. 近 7 天失败率检查
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentTotal = await SendRecord.count({
    where: { created_at: { [Op.gte]: sevenDaysAgo } }
  });

  if (recentTotal > 0) {
    const recentFailed = await SendRecord.count({
      where: {
        send_status: 'failed',
        created_at: { [Op.gte]: sevenDaysAgo }
      }
    });
    const failRate = recentFailed / recentTotal;
    if (failRate > 0.3) {
      alerts.push({
        level: 'error',
        type: 'high_failure_rate',
        message: `近 7 天发送失败率 ${(failRate * 100).toFixed(1)}%（${recentFailed}/${recentTotal}）`,
        created_at: new Date().toISOString()
      });
    }
  }

  // 2. 超过 3 天无成功发送
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentSuccess = await SendRecord.count({
    where: {
      send_status: 'success',
      created_at: { [Op.gte]: threeDaysAgo }
    }
  });

  if (recentSuccess === 0 && recentTotal > 0) {
    alerts.push({
      level: 'warning',
      type: 'no_recent_success',
      message: '超过 3 天无成功发送记录，请检查服务状态',
      created_at: new Date().toISOString()
    });
  }

  // 3. 发送服务心跳超时
  const senderStatus = await checkSenderHealth();
  if (senderStatus === 'unhealthy') {
    const lastBeat = await getSenderHeartbeat();
    alerts.push({
      level: 'error',
      type: 'heartbeat_timeout',
      message: `发送服务心跳超时${lastBeat ? `（最后心跳: ${lastBeat}）` : '（无心跳记录）'}`,
      created_at: new Date().toISOString()
    });
  }

  return alerts;
};
