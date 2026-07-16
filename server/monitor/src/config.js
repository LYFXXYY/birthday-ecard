/**
 * 配置加载模块
 *
 * 从 .env 文件读取配置，支持运行时热更新。
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const monitorRoot = path.resolve(__dirname, '..');
const envPath = path.resolve(monitorRoot, '.env');

/**
 * 读取并解析 .env 文件，返回配置对象
 */
export const loadConfig = () => {
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const get = (key, fallback = '') => parsed[key] || process.env[key] || fallback;
  const getInt = (key, fallback) => {
    const val = get(key);
    return val ? parseInt(val, 10) : fallback;
  };

  // 将相对路径解析为相对于 monitor 根目录的绝对路径
  const resolveRelative = (p) => path.isAbsolute(p) ? p : path.resolve(monitorRoot, p);

  return {
    main: {
      host: get('MAIN_HOST', 'http://localhost'),
      port: getInt('MAIN_PORT', 3001),
      healthEndpoint: get('HEALTH_ENDPOINT', '/api/health'),
      get baseUrl() {
        return `${this.host}:${this.port}`;
      }
    },
    heartbeat: {
      dir: resolveRelative(get('HEARTBEAT_DIR', '')),
      timeoutHours: getInt('HEARTBEAT_TIMEOUT_HOURS', 25)
    },
    database: {
      host: get('DB_HOST', 'localhost'),
      port: getInt('DB_PORT', 3306),
      user: get('DB_USER', 'root'),
      password: get('DB_PASSWORD', ''),
      name: get('DB_NAME', 'birthday')
    },
    intervals: {
      httpCheck: getInt('HTTP_CHECK_INTERVAL', 30),
      portCheck: getInt('PORT_CHECK_INTERVAL', 60),
      heartbeatCheck: getInt('HEARTBEAT_CHECK_INTERVAL', 60),
      dbCheck: getInt('DB_CHECK_INTERVAL', 300)
    },
    log: {
      dir: resolveRelative(get('LOG_DIR', './logs')),
      maxDays: getInt('LOG_MAX_DAYS', 30)
    }
  };
};
