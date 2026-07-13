/**
 * 中国移动 CSP 北向接口 V2.4.3 配置
 *
 * 支持运行时动态重载：每次调用 loadCspConfig() 都从 .env 文件重新读取，
 * 管理员通过前端修改配置后无需重启服务即可生效。
 *
 * 环境变量（.env）：
 *   CSP_APP_ID           - 应用 ID（ChatbotID）
 *   CSP_PASSWORD          - 应用密码
 *   CSP_SERVER_ROOT       - 接口根地址（默认 https://api.5gcsp.mas.10086.cn/ocsp/developer）
 *   CSP_FILE_SERVER_ROOT  - 媒体文件服务地址（默认 https://api.5gcsp.mas.10086.cn/ocsp/fileservice）
 *   CSP_CHATBOT_URI       - Chatbot URI（sip:{ChatbotID}@botplatform.rcs.chinamobile.com）
 *   CSP_CALLBACK_URL      - 业务回调地址（客户侧公网地址）
 *   CSP_VIDEO_TEMPLATE_ID - 5G 视信模板 ID（审核通过后获取）
 *   CSP_TEMP_STORE_TIME   - 消息离线缓存时长（秒），最大 259200（3天）
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 文件路径（server/.env）
const ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

/**
 * 从 .env 文件重新读取并解析 CSP 配置
 * 每次发送时调用，确保管理员修改的配置即时生效
 *
 * @returns {object} 完整的 CSP 配置对象
 */
export const loadCspConfig = () => {
  // 重新解析 .env 文件（不覆盖 process.env 中已有的其他变量）
  const parsed = dotenv.parse(
    // 用同步方法避免异步复杂性，文件很小（<1KB）无性能问题
    fs.readFileSync(ENV_PATH)
  );

  // 优先取 .env 最新值，回退到 process.env（兼容启动时设置的环境变量）
  const get = (key, fallback = '') => parsed[key] || process.env[key] || fallback;

  const appid = get('CSP_APP_ID');
  const password = get('CSP_PASSWORD');
  const serverRoot = get('CSP_SERVER_ROOT', 'https://api.5gcsp.mas.10086.cn/ocsp/developer');
  const fileServerRoot = get('CSP_FILE_SERVER_ROOT', 'https://api.5gcsp.mas.10086.cn/ocsp/fileservice');
  const chatbotURI = get('CSP_CHATBOT_URI', appid ? `sip:${appid}@botplatform.rcs.chinamobile.com` : '');
  const callbackURL = get('CSP_CALLBACK_URL');
  const videoTemplateId = get('CSP_VIDEO_TEMPLATE_ID');
  const tempStoreTime = parseInt(get('CSP_TEMP_STORE_TIME', '259200'), 10) || 259200;

  return {
    appid,
    password,
    serverRoot,
    fileServerRoot,
    chatbotURI,
    callbackURL,
    videoTemplateId,
    tempStoreTime,
    /** 5G 视频短信发送接口路径 */
    sendPath: '/messaging/group/template/outbound',
    /** 单次请求最大手机号数量 */
    maxPhonesPerRequest: 100,
    /** 视频文件大小上限（字节），超过此值不使用 mmsBodyText */
    videoSizeLimit: 2 * 1024 * 1024,
    /** 大视频上限（字节），2M~5M 使用 mmsBodyTextLarge */
    videoSizeLimitLarge: 5 * 1024 * 1024,
    /** HTTP 请求超时（毫秒） */
    timeout: 30000
  };
};

/**
 * 生成 CSP 认证请求头
 *
 * 算法（V2.4.3 规范）：
 *   1. GMT = RFC 1123 格式 UTC 时间（如 "Sat, 12 Jul 2026 08:30:00 GMT"）
 *   2. step1 = SHA256(password)              → hex 字符串
 *   3. step2 = SHA256(step1 + GMT)           → hex 字符串
 *   4. credential = appid + ':' + step2
 *   5. Authorization = 'Basic ' + Base64(credential)
 *
 * 完整请求头包含：Authorization, Date, Content-Type, UserType
 *
 * @param {string} password - CSP 密码
 * @param {string} appid - CSP 应用 ID
 * @returns {{ authorization: string, date: string, contentType: string, userType: string }}
 */
export const buildCspAuth = async (password, appid) => {
  const { createHash } = await import('crypto');

  // RFC 1123 格式 GMT 时间（与 Java 参考代码 SimpleDateFormat 一致）
  const gmtDate = new Date().toUTCString();

  // step1: SHA256(password) → hex
  const step1 = createHash('sha256').update(password).digest('hex');
  // step2: SHA256(step1 + gmtDate) → hex
  const step2 = createHash('sha256').update(step1 + gmtDate).digest('hex');
  // credential = appid:step2
  const credential = `${appid}:${step2}`;
  // Authorization = Basic Base64(credential)
  const authorization = `Basic ${Buffer.from(credential).toString('base64')}`;

  return {
    authorization,
    date: gmtDate,
    contentType: 'application/xml;charset=UTF-8',
    userType: '10'
  };
};
