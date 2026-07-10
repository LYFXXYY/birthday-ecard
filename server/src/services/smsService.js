// 短信/彩信发送服务
// 支持两种模式：mock（模拟发送，开发环境默认）和 carrier（对接运营商API）
// 切换到真实运营商只需修改 .env 中的 SMS_PROVIDER 和相关认证参数

import axios from 'axios';
import { config } from '../config/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('sms');

/**
 * 发送短信/彩信（主入口函数）
 * 
 * 根据 SMS_PROVIDER 配置自动选择发送模式，内置重试机制。
 * 该函数永远不会抛出异常，所有错误都通过返回值中的 success/error 字段体现。
 * 
 * @param {string} phone - 接收方手机号
 * @param {string} smsBody - 完整短信内容文本（由 sendService.buildSmsBody 构建）
 * @param {string} employeeName - 员工姓名（用于日志）
 * @returns {Promise<{
 *   success: boolean,      // 是否发送成功
 *   messageId: string|null,// 运营商返回的消息ID（mock模式为模拟ID）
 *   provider: string,      // 使用的发送模式：'mock' 或 'carrier'
 *   retryCount: number,    // 实际重试次数
 *   error: string|null,    // 失败时的错误信息
 *   sentAt: Date           // 发送时间
 * }>}
 */
export const sendSMS = async (phone, smsBody, employeeName) => {
  const provider = config.sms.provider;
  const sentAt = new Date();

  try {
    if (provider === 'carrier') {
      return await _carrierSend(phone, smsBody, employeeName);
    } else {
      return await _mockSend(phone, smsBody, employeeName);
    }
  } catch (error) {
    return {
      success: false,
      messageId: null,
      provider,
      retryCount: 0,
      error: `未预期的错误: ${error.message}`,
      sentAt
    };
  }
};

/**
 * 模拟短信发送 - 仅在控制台输出日志，不实际发送短信
 * 开发阶段使用此模式验证流程是否正常
 */
const _mockSend = async (phone, smsBody, employeeName) => {
  await new Promise(resolve => setTimeout(resolve, 100));

  const messageId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  logger.info(`[短信模拟] 收件人: ${phone}`);
  logger.info(`[短信模拟] 员工: ${employeeName}`);
  logger.info(`[短信模拟] 短信内容: ${smsBody}`);
  logger.info(`[短信模拟] 消息ID: ${messageId}`);

  return {
    success: true,
    messageId,
    provider: 'mock',
    retryCount: 0,
    error: null,
    sentAt: new Date()
  };
};

/**
 * 通过运营商API发送短信/彩信
 * 
 * 注意：当前为骨架实现，拿到运营商API文档后需要补充：
 * 1. 具体的请求URL路径
 * 2. 请求头格式（认证方式：Bearer Token / API Key / 签名等）
 * 3. 请求体格式（手机号、内容的字段名）
 * 4. 响应解析逻辑（成功/失败的判断条件和消息ID提取）
 */
const _carrierSend = async (phone, smsBody, employeeName) => {
  const { apiUrl, apiKey, senderId, timeout } = config.sms;

  if (!apiUrl) {
    throw new Error('SMS_API_URL 未配置，无法调用运营商接口');
  }

  // TODO: 根据运营商文档调整请求格式
  const response = await axios.post(apiUrl, {
    phone_number: phone,
    content: smsBody,
    sender_id: senderId,
    type: 'sms'
  }, {
    headers: {
      'Content-Type': 'application/json',
      // TODO: 根据运营商文档调整认证方式
      'Authorization': `Bearer ${apiKey}`,
    },
    timeout,
  });

  // TODO: 根据运营商文档调整响应解析逻辑
  const data = response.data;
  const isSuccess = data.code === 0 || data.code === '0' || data.status === 'success';
  
  if (!isSuccess) {
    throw new Error(`运营商返回错误: ${data.message || JSON.stringify(data)}`);
  }

  const messageId = data.message_id || data.msgId || data.id || null;

  return {
    success: true,
    messageId: String(messageId),
    provider: 'carrier',
    retryCount: 0,
    error: null,
    sentAt: new Date(),
    rawResponse: data
  };
};
