/**
 * 短信配置管理路由
 *
 * GET  /api/admin/sms-config  — 读取当前 CSP 短信配置
 * PUT  /api/admin/sms-config  — 更新 CSP 短信配置（写入 .env 文件）
 *
 * 管理员通过前端修改配置后无需重启服务，下次发送时自动重载。
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { getLogger } from '../utils/logger.js';

const router = express.Router();
const logger = getLogger('sms-config');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

/**
 * CSP 相关的 .env 键定义
 */
const CSP_KEYS = [
  { key: 'CSP_APP_ID', label: '应用 ID（ChatbotID）', description: 'CSP 平台接口配置页获取，参与接口鉴权加密' },
  { key: 'CSP_PASSWORD', label: '应用密码', description: 'CSP 平台创建 Chatbot 应用时生成，用于生成鉴权 Token' },
  { key: 'CSP_SERVER_ROOT', label: '接口根地址', description: '默认 https://api.5gcsp.mas.10086.cn/ocsp/developer' },
  { key: 'CSP_FILE_SERVER_ROOT', label: '媒体文件服务地址', description: '默认 https://api.5gcsp.mas.10086.cn/ocsp/fileservice' },
  { key: 'CSP_CHATBOT_URI', label: 'Chatbot URI（SIP 地址）', description: '格式 sip:ChatbotID@botplatform.rcs.chinamobile.com，留空自动拼接' },
  { key: 'CSP_CALLBACK_URL', label: '业务回调地址', description: '客户侧公网地址，供 CSP 平台异步推送状态报告' },
  { key: 'CSP_VIDEO_TEMPLATE_ID', label: '5G 视信模板 ID', description: 'CSP 平台审核通过的视频模板编号，发送核心参数' },
  { key: 'CSP_TEMP_STORE_TIME', label: '消息离线缓存时长（秒）', description: '最大 259200（3天），终端离线时消息缓存后自动重发' }
];

/**
 * 基础 SMS 配置键
 */
const SMS_KEYS = [
  { key: 'SMS_PROVIDER', label: '短信发送模式', description: 'mock=模拟发送（开发），carrier=运营商接口（生产）' },
  { key: 'SMS_MAX_RETRIES', label: '最大重试次数', description: '发送失败后的重试次数，默认 3' },
  { key: 'SMS_RETRY_DELAY', label: '重试间隔（毫秒）', description: '两次重试之间的等待时间，默认 1000' },
  { key: 'SMS_TIMEOUT', label: '请求超时（毫秒）', description: 'HTTP 请求超时时间，默认 10000' }
];

/**
 * GET /api/admin/sms-config
 * 读取当前短信配置（脱敏显示）
 */
router.get('/', (req, res) => {
  try {
    // 从 .env 文件读取最新值
    const parsed = fs.existsSync(ENV_PATH)
      ? dotenv.parse(fs.readFileSync(ENV_PATH))
      : {};

    // 脱敏函数：只显示前4位和后4位
    const mask = (val) => {
      if (!val || val.length <= 8) return val ? '****' : '';
      return val.slice(0, 4) + '****' + val.slice(-4);
    };

    const cspItems = CSP_KEYS.map(({ key, label, description }) => {
      const value = parsed[key] || '';
      const isSecret = key === 'CSP_PASSWORD';
      return {
        key,
        label,
        description,
        value: isSecret ? mask(value) : value,
        isSecret,
        // 标记是否已配置
        configured: !!value
      };
    });

    const smsItems = SMS_KEYS.map(({ key, label, description }) => {
      const value = parsed[key] || '';
      return {
        key,
        label,
        description,
        value,
        configured: !!value
      };
    });

    res.json({
      code: 200,
      message: 'OK',
      data: {
        csp: cspItems,
        sms: smsItems
      }
    });
  } catch (err) {
    logger.error('[短信配置] 读取失败:', err.message);
    res.status(500).json({ code: 500, message: '操作失败，请稍后重试' });
  }
});

/**
 * PUT /api/admin/sms-config
 * 更新短信配置（写入 .env 文件）
 *
 * 请求体：{ CSP_APP_ID: 'xxx', CSP_PASSWORD: 'xxx', ... }
 * 只更新传入的键，未传入的保持不变
 */
router.put('/', (req, res) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ code: 400, message: '请求体格式错误' });
    }

    // 允许的键白名单
    const allowedKeys = [...CSP_KEYS, ...SMS_KEYS].map(k => k.key);
    const validUpdates = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedKeys.includes(key)) {
        validUpdates[key] = String(value).trim();
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return res.status(400).json({ code: 400, message: '没有有效的配置项需要更新' });
    }

    // 读取当前 .env 文件内容
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    // 逐行处理：更新已有行或追加新行
    const lines = envContent.split('\n');
    const updatedKeys = new Set();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 匹配 KEY=VALUE 格式（忽略注释和空行）
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && validUpdates.hasOwnProperty(match[1])) {
        lines[i] = `${match[1]}=${validUpdates[match[1]]}`;
        updatedKeys.add(match[1]);
      }
    }

    // 追加未出现的键
    for (const [key, value] of Object.entries(validUpdates)) {
      if (!updatedKeys.has(key)) {
        lines.push(`${key}=${value}`);
      }
    }

    // 写回 .env 文件
    fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');

    // 同步更新 process.env（当前进程立即生效）
    for (const [key, value] of Object.entries(validUpdates)) {
      process.env[key] = value;
    }

    logger.info(`[短信配置] 已更新 ${Object.keys(validUpdates).length} 项配置: ${Object.keys(validUpdates).join(', ')}`);

    res.json({
      code: 200,
      message: '配置更新成功，下次发送时将使用新配置',
      data: { updated: Object.keys(validUpdates) }
    });
  } catch (err) {
    logger.error('[短信配置] 更新失败:', err.message);
    res.status(500).json({ code: 500, message: '操作失败，请稍后重试' });
  }
});

export default router;
