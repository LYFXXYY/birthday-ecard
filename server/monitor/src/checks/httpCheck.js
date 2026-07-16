/**
 * HTTP 健康检查
 *
 * 向主项目发送 HTTP GET 请求，检查服务是否存活。
 * 使用 Node.js 内置 http/https 模块，无需额外依赖。
 */
import http from 'http';
import https from 'https';
import { URL } from 'url';

/**
 * 执行 HTTP 健康检查
 *
 * @param {object} config - 主项目配置
 * @param {string} config.baseUrl - 如 http://localhost:3001
 * @param {string} config.healthEndpoint - 如 /api/monitor/status
 * @returns {Promise<{module: string, name: string, status: string, message: string, responseTime?: number}>}
 */
export const httpCheck = async (config) => {
  const url = `${config.baseUrl}${config.healthEndpoint}`;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, { timeout: 5000 }, (res) => {
      const responseTime = Date.now() - startTime;
      let body = '';

      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            module: 'http',
            name: 'HTTP 健康检查',
            status: 'ok',
            message: `服务正常 (HTTP ${res.statusCode})`,
            responseTime
          });
        } else {
          resolve({
            module: 'http',
            name: 'HTTP 健康检查',
            status: 'error',
            message: `异常响应 (HTTP ${res.statusCode})`,
            responseTime
          });
        }
      });
    });

    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      const detail = err.message || err.code || '未知错误';
      resolve({
        module: 'http',
        name: 'HTTP 健康检查',
        status: 'error',
        message: `连接失败: ${detail}`,
        responseTime
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      resolve({
        module: 'http',
        name: 'HTTP 健康检查',
        status: 'error',
        message: '请求超时 (5s)',
        responseTime
      });
    });
  });
};
