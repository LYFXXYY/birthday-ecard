// 短信/彩信发送服务
// 支持两种模式：mock（模拟发送，开发环境）和 carrier（中国移动 CSP V2.4.3）

import axios from 'axios';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { loadCspConfig, buildCspAuth } from '../config/carrier-sms.config.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('sms');

/**
 * 发送短信/彩信（主入口函数）
 *
 * @param {string} phone - 接收方手机号
 * @param {string} smsBody - 完整短信内容文本
 * @param {string} employeeName - 员工姓名（用于日志）
 * @param {object} [options] - 可选参数
 * @param {string} [options.videoPath] - 视频文件绝对路径（用于 5G 视频彩信）
 * @param {number} [options.videoSize] - 视频文件大小（字节）
 * @param {string} [options.cardUrl] - 贺卡链接
 * @returns {Promise<{
 *   success: boolean,
 *   messageId: string|null,
 *   provider: string,
 *   retryCount: number,
 *   error: string|null,
 *   sentAt: Date
 * }>}
 */
export const sendSMS = async (phone, smsBody, employeeName, options = {}) => {
  const provider = config.sms.provider;
  const sentAt = new Date();

  try {
    if (provider === 'carrier') {
      return await _carrierSend(phone, smsBody, employeeName, options);
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
 * 模拟短信发送 - 仅在控制台输出日志
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
 * 中国移动 CSP 北向接口 V2.4.3 - 5G 视频短信发送
 *
 * 协议要点（严格遵循 V2.4.3 规范）：
 * - 认证：Basic BASE64(appid:SHA256(SHA256(password)+GMT))
 * - 请求体：XML 格式（msg:outboundMessageRequest 标准结构）
 * - 请求头：Authorization, Date(RFC 1123), Content-Type, UserType=10
 * - 视频 ≤2M 使用 mmsBodyText，2M~5M 使用 mmsBodyTextLarge，>5M 拒绝
 * - 单次请求最多 100 个手机号
 * - UUID 格式 contributionID 标识会话
 * - temporaryStoredTime 最大 259200 秒（3天）
 */
const _carrierSend = async (phone, smsBody, employeeName, options = {}) => {
  // 每次发送重新加载配置（管理员通过前端修改后即时生效）
  const cspConfig = loadCspConfig();

  if (!cspConfig.appid || !cspConfig.password) {
    throw new Error('CSP 认证参数未配置（CSP_APP_ID / CSP_PASSWORD）');
  }

  if (!cspConfig.videoTemplateId) {
    throw new Error('CSP 视频模板 ID 未配置（CSP_VIDEO_TEMPLATE_ID）');
  }

  // 视频文件大小校验
  const videoSize = options.videoSize || 0;
  if (videoSize > cspConfig.videoSizeLimitLarge) {
    throw new Error(`视频文件过大: ${(videoSize / 1024 / 1024).toFixed(1)}MB，上限 ${cspConfig.videoSizeLimitLarge / 1024 / 1024}MB`);
  }

  // 生成认证请求头
  const authHeaders = await buildCspAuth(cspConfig.password, cspConfig.appid);

  // 拼接请求 URL（V2.4.3 标准路径）
  const sendUrl = `${cspConfig.serverRoot}${cspConfig.sendPath}/${cspConfig.chatbotURI}/requests`;

  // 构建 XML 请求体（符合 V2.4.3 标准格式）
  const xmlBody = buildSendXml({
    phone,
    videoTemplateId: cspConfig.videoTemplateId,
    tempStoreTime: cspConfig.tempStoreTime,
    videoSize,
    videoSizeLimit: cspConfig.videoSizeLimit
  });

  logger.info(`[CSP发送] 请求URL: ${sendUrl}`);
  logger.info(`[CSP发送] 收件人: ${phone}, 员工: ${employeeName}`);
  logger.info(`[CSP发送] 模板ID: ${cspConfig.videoTemplateId}, 视频大小: ${(videoSize / 1024).toFixed(0)}KB`);

  const response = await axios.post(sendUrl, xmlBody, {
    headers: {
      'Authorization': authHeaders.authorization,
      'Date': authHeaders.date,
      'Content-Type': authHeaders.contentType,
      'UserType': authHeaders.userType,
      'appId': cspConfig.appid
    },
    timeout: cspConfig.timeout
  });

  // 解析 XML 响应
  const xmlResp = typeof response.data === 'string' ? response.data : '';
  const resultCode = extractXmlValue(xmlResp, 'resultCode');
  const resultDesc = extractXmlValue(xmlResp, 'resultDesc');
  const messageId = extractXmlValue(xmlResp, 'messageId');

  logger.info(`[CSP发送] 响应: resultCode=${resultCode}, resultDesc=${resultDesc}, messageId=${messageId}`);

  // resultCode 为 '0' 表示成功
  if (resultCode !== '0' && resultCode !== null) {
    throw new Error(`CSP 返回错误: [${resultCode}] ${resultDesc || '未知错误'}`);
  }

  return {
    success: true,
    messageId: messageId || `csp_${Date.now()}`,
    provider: 'carrier',
    retryCount: 0,
    error: null,
    sentAt: new Date(),
    rawResponse: xmlResp
  };
};

/**
 * 构建 CSP 5G 视频短信发送 XML 请求体
 *
 * 严格遵循 V2.4.3 规范的 msg:outboundMessageRequest 结构：
 * - destinationAddress: tel:+86{phone}
 * - contentType: static-template
 * - bodyText / mmsBodyText: 模板 JSON（视频≤2M）
 * - mmsBodyTextLarge: 模板 JSON（视频 2M~5M）
 * - temporaryStoredTime: 离线缓存时长
 * - contributionID: UUID 会话标识
 * - storeSupported: true
 */
const buildSendXml = ({ phone, videoTemplateId, tempStoreTime, videoSize, videoSizeLimit }) => {
  // 转义 XML 特殊字符
  const escapeXml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const escapedPhone = escapeXml(phone);
  const escapedTemplateId = escapeXml(videoTemplateId);
  const contributionId = randomUUID();

  // 模板 JSON 内容
  const templateJson = `{"templateID":"${escapedTemplateId}"}`;

  // 根据视频大小选择字段
  let bodyFieldsXml = '';
  if (videoSize > videoSizeLimit) {
    // 2M~5M：使用 mmsBodyTextLarge
    bodyFieldsXml = `    <bodyText>${templateJson}</bodyText>
    <mmsBodyTextLarge>${templateJson}</mmsBodyTextLarge>`;
  } else {
    // ≤2M（或无视频）：使用 mmsBodyText
    bodyFieldsXml = `    <bodyText>${templateJson}</bodyText>
    <mmsBodyText>${templateJson}</mmsBodyText>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<msg:outboundMessageRequest xmlns:msg="urn:oma:xml:rest:netapi:messaging:1">
    <destinationAddress>tel:+86${escapedPhone}</destinationAddress>
    <contentType>static-template</contentType>
${bodyFieldsXml}
    <temporaryStoredTime>${tempStoreTime}</temporaryStoredTime>
    <contributionID>${contributionId}</contributionID>
    <storeSupported>true</storeSupported>
</msg:outboundMessageRequest>`;
};

/**
 * 简易 XML 值提取
 */
const extractXmlValue = (xml, tag) => {
  if (!xml) return null;
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
};
