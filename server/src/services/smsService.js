// 短信/彩信发送服务
// 支持两种模式：mock（模拟发送，开发环境）和 carrier（中国移动 CSP V2.4.3）

import axios from 'axios';
import { config } from '../config/index.js';
import { cspConfig, buildCspAuth } from '../config/carrier-sms.config.js';
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
 * 协议要点：
 * - 认证：Basic BASE64(appid:SHA256(SHA256(password)+GMT))
 * - 请求体：XML 格式（非 JSON）
 * - 视频 < 2M 时使用 mmsBodyText 字段内嵌
 * - 单次请求最多 100 个手机号
 */
const _carrierSend = async (phone, smsBody, employeeName, options = {}) => {
  if (!cspConfig.appid || !cspConfig.password) {
    throw new Error('CSP 认证参数未配置（CSP_APP_ID / CSP_PASSWORD）');
  }

  const { authorization, gmt } = await buildCspAuth();
  const sendUrl = `${cspConfig.serverRoot}${cspConfig.sendPath}`;

  // 构建 XML 请求体
  const xmlBody = buildSendXml({
    phone,
    smsBody,
    chatbotURI: cspConfig.chatbotURI,
    videoPath: options.videoPath || null
  });

  logger.info(`[CSP发送] 请求URL: ${sendUrl}`);
  logger.info(`[CSP发送] 收件人: ${phone}, 员工: ${employeeName}`);

  const response = await axios.post(sendUrl, xmlBody, {
    headers: {
      'Content-Type': 'application/xml;charset=UTF-8',
      'Authorization': authorization,
      'GMT': gmt,
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
 */
const buildSendXml = ({ phone, smsBody, chatbotURI, videoPath }) => {
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

  const escapedBody = escapeXml(smsBody);
  const escapedPhone = escapeXml(phone);
  const escapedChatbotURI = escapeXml(chatbotURI);

  // 构建 mmsBody 部分
  let mmsBodyXml = '';

  if (videoPath) {
    // 有视频时，使用 mmsBodyText + 视频附件
    mmsBodyXml = `
      <mmsBody>
        <mmsBodyText>${escapedBody}</mmsBodyText>
        <mmsAttachment>
          <attachmentName>video.mp4</attachmentName>
          <attachmentUrl>${escapeXml(videoPath)}</attachmentUrl>
          <attachmentType>video/mp4</attachmentType>
        </mmsAttachment>
      </mmsBody>`;
  } else {
    // 纯文本短信
    mmsBodyXml = `
      <mmsBody>
        <mmsBodyText>${escapedBody}</mmsBodyText>
      </mmsBody>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<SendVideoMmsRequest>
  <requestId>${Date.now()}</requestId>
  <chatbotURI>${escapedChatbotURI}</chatbotURI>
  <msisdn>${escapedPhone}</msisdn>
  ${mmsBodyXml}
</SendVideoMmsRequest>`;
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
