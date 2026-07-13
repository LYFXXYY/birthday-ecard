/**
 * 中国移动 CSP 北向接口 V2.4.3 配置
 *
 * 环境变量（.env）：
 *   CSP_APP_ID        - 应用 ID（ChatbotID）
 *   CSP_PASSWORD     - 应用密码
 *   CSP_SERVER_ROOT  - 接口根地址（默认 https://api.5gcsp.mas.10086.cn/ocsp/developer）
 *   CSP_CHATBOT_URI  - Chatbot URI（sip:{ChatbotID}@botplatform.rcs.chinamobile.com）
 */

const appid = process.env.CSP_APP_ID || '';
const password = process.env.CSP_PASSWORD || '';
const serverRoot = process.env.CSP_SERVER_ROOT || 'https://api.5gcsp.mas.10086.cn/ocsp/developer';
const chatbotURI = process.env.CSP_CHATBOT_URI || `sip:${appid}@botplatform.rcs.chinamobile.com`;

export const cspConfig = {
  appid,
  password,
  serverRoot,
  chatbotURI,
  /** 5G 视频短信发送接口路径 */
  sendPath: '/service/msgSend/v2_4_3/sendVideoMms',
  /** 单次请求最大手机号数量 */
  maxPhonesPerRequest: 100,
  /** 视频文件大小上限（字节），超过此值不使用 mmsBodyText */
  videoSizeLimit: 2 * 1024 * 1024,
  /** HTTP 请求超时（毫秒） */
  timeout: 30000
};

/**
 * 生成 CSP 认证 Authorization 头
 *
 * 算法：
 *   1. GMT = 当前 UTC 时间，格式 yyyyMMddHHmmss
 *   2. step1 = SHA256(password)              → hex 字符串
 *   3. step2 = SHA256(step1 + GMT)           → hex 字符串
 *   4. credential = appid + ':' + Base64(step2)
 *   5. Authorization = 'Basic ' + Base64(credential)
 *
 * @returns {{ authorization: string, gmt: string }}
 */
export const buildCspAuth = async () => {
  const { createHash } = await import('crypto');

  const now = new Date();
  const gmt = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0')
  ].join('');

  // step1: SHA256(password) → hex
  const step1 = createHash('sha256').update(password).digest('hex');
  // step2: SHA256(step1 + gmt) → hex
  const step2 = createHash('sha256').update(step1 + gmt).digest('hex');
  // credential = appid:Base64(step2)
  const credential = `${appid}:${Buffer.from(step2).toString('base64')}`;
  // Authorization = Basic Base64(credential)
  const authorization = `Basic ${Buffer.from(credential).toString('base64')}`;

  return { authorization, gmt };
};
