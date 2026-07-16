/**
 * 端口存活检测
 *
 * 通过 TCP 连接检测主项目端口是否在监听。
 * 使用 Node.js 内置 net 模块。
 */
import net from 'net';

/**
 * 执行端口存活检测
 *
 * @param {object} config - 主项目配置
 * @param {string} config.host - 如 http://localhost
 * @param {number} config.port - 如 3001
 * @returns {Promise<{module: string, name: string, status: string, message: string, responseTime?: number}>}
 */
export const portCheck = async (config) => {
  // 从 baseUrl 中提取 hostname
  const host = config.host.replace(/^https?:\/\//, '');
  const port = config.port;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(3000);

    socket.on('connect', () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        module: 'port',
        name: '端口存活检测',
        status: 'ok',
        message: `端口 ${port} 正在监听`,
        responseTime
      });
    });

    socket.on('timeout', () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        module: 'port',
        name: '端口存活检测',
        status: 'error',
        message: `端口 ${port} 连接超时 (3s)`,
        responseTime
      });
    });

    socket.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        module: 'port',
        name: '端口存活检测',
        status: 'error',
        message: `端口 ${port} 无法连接: ${err.code || err.message}`,
        responseTime
      });
    });

    socket.connect(port, host);
  });
};
