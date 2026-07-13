/**
 * 心跳文件监控
 *
 * 读取主项目的心跳文件，检查时间戳是否超时。
 * 心跳文件由主项目的 heartbeatService.js 写入。
 */
import fs from 'fs';
import path from 'path';

/**
 * 执行心跳文件检查
 *
 * @param {object} config - 心跳配置
 * @param {string} config.dir - 心跳文件目录
 * @param {number} config.timeoutHours - 超时阈值（小时）
 * @returns {Promise<{module: string, name: string, status: string, message: string}>}
 */
export const heartbeatCheck = async (config) => {
  const heartbeatFile = path.join(config.dir, 'sender.json');

  // 1. 检查文件是否存在
  if (!fs.existsSync(heartbeatFile)) {
    return {
      module: 'heartbeat',
      name: '心跳文件监控',
      status: 'warning',
      message: `心跳文件不存在: ${heartbeatFile}（主项目可能未启动过发送服务）`
    };
  }

  // 2. 读取并解析
  let data;
  try {
    const content = fs.readFileSync(heartbeatFile, 'utf-8');
    data = JSON.parse(content);
  } catch (err) {
    return {
      module: 'heartbeat',
      name: '心跳文件监控',
      status: 'error',
      message: `心跳文件读取/解析失败: ${err.message}`
    };
  }

  // 3. 检查时间戳
  if (!data.last_beat) {
    return {
      module: 'heartbeat',
      name: '心跳文件监控',
      status: 'warning',
      message: '心跳文件中无 last_beat 字段'
    };
  }

  const beatTime = new Date(data.last_beat);
  const now = new Date();
  const hoursSince = (now - beatTime) / (1000 * 60 * 60);

  if (hoursSince > config.timeoutHours) {
    return {
      module: 'heartbeat',
      name: '心跳文件监控',
      status: 'error',
      message: `心跳超时 ${hoursSince.toFixed(1)} 小时（阈值 ${config.timeoutHours}h），最后心跳: ${data.last_beat}`
    };
  }

  return {
    module: 'heartbeat',
    name: '心跳文件监控',
    status: 'ok',
    message: `心跳正常（${hoursSince.toFixed(1)} 小时前）`
  };
};
