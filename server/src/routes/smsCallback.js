/**
 * CSP 短信投递状态回调路由
 * 
 * 中国移动 CSP 北向接口 V2.4.3 异步回调：
 * - StatusReportNotification：投递状态报告
 * - InboundMessageNotification：上行消息通知（预留）
 * 
 * 这些路由是公开端点，供运营商服务器回调，无需认证。
 */
import express from 'express';
import { getLogger } from '../utils/logger.js';
import { SendRecord } from '../models/index.js';

const router = express.Router();
const logger = getLogger('sms-callback');

/**
 * 解析 XML 中的指定标签值（简易 XML 解析，无需引入额外依赖）
 * @param {string} xml - XML 字符串
 * @param {string} tag - 标签名
 * @returns {string|null}
 */
const extractXmlValue = (xml, tag) => {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
};

/**
 * POST /api/sms-callback/StatusReportNotification/:chatbotUri
 * 
 * 接收移动公司投递状态报告回调
 * 
 * 回调 XML 示例：
 * <StatusReportNotification>
 *   <correlator>xxx</correlator>
 *   <messageId>msg-uuid-xxx</messageId>
 *   <status>Delivered</status>
 *   <statusDescription>...</statusDescription>
 *   <time>2025-07-12T10:30:00Z</time>
 * </StatusReportNotification>
 */
router.post('/StatusReportNotification/:chatbotUri', async (req, res) => {
  try {
    const { chatbotUri } = req.params;
    // express.text() 中间件将 body 解析为字符串
    const xmlBody = typeof req.body === 'string' ? req.body : '';

    logger.info(`[CSP回调] 收到投递状态报告, chatbotUri=${chatbotUri}`);

    if (!xmlBody) {
      logger.warn('[CSP回调] 请求体为空');
      return res.status(200).json({ code: 200, message: 'empty body' });
    }

    // 解析 XML 字段
    const messageId = extractXmlValue(xmlBody, 'messageId');
    const status = extractXmlValue(xmlBody, 'status');
    const time = extractXmlValue(xmlBody, 'time');

    logger.info(`[CSP回调] messageId=${messageId}, status=${status}, time=${time}`);

    if (!messageId) {
      logger.warn('[CSP回调] 缺少 messageId');
      return res.status(200).json({ code: 200, message: 'missing messageId' });
    }

    // 查找对应的发送记录
    const record = await SendRecord.findOne({ where: { message_id: messageId } });
    if (!record) {
      logger.warn(`[CSP回调] 未找到 message_id=${messageId} 对应的发送记录`);
      return res.status(200).json({ code: 200, message: 'record not found' });
    }

    // 更新投递状态
    const updateData = {
      delivery_status: status || 'unknown'
    };
    if (time) {
      updateData.delivery_time = new Date(time);
    }

    await record.update(updateData);
    logger.info(`[CSP回调] 已更新记录 id=${record.id}, delivery_status=${status}`);

    // CSP 接口要求返回 HTTP 200
    res.status(200).json({ code: 200, message: 'OK' });
  } catch (err) {
    logger.error('[CSP回调] 处理异常:', err.message);
    // 即使出错也返回 200，避免运营商重试风暴
    res.status(200).json({ code: 200, message: 'error' });
  }
});

/**
 * POST /api/sms-callback/InboundMessageNotification/:chatbotUri
 * 
 * 接收上行消息通知（预留端点，当前仅记录日志）
 */
router.post('/InboundMessageNotification/:chatbotUri', async (req, res) => {
  const { chatbotUri } = req.params;
  logger.info(`[CSP回调] 收到上行消息通知, chatbotUri=${chatbotUri}`);
  // 预留：后续可扩展处理用户回复消息
  res.status(200).json({ code: 200, message: 'OK' });
});

export default router;
