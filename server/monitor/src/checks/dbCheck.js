/**
 * 数据库直连检查
 *
 * 直接使用 MySQL 客户端连接数据库，验证数据库服务是否可用。
 * 独立于主项目后端，即使后端进程挂了也能检测数据库状态。
 */
import mysql from 'mysql2/promise';

/**
 * 执行数据库连接检查
 *
 * @param {object} config - 数据库配置
 * @param {string} config.host
 * @param {number} config.port
 * @param {string} config.user
 * @param {string} config.password
 * @param {string} config.name
 * @returns {Promise<{module: string, name: string, status: string, message: string, responseTime?: number}>}
 */
export const dbCheck = async (config) => {
  const startTime = Date.now();
  let connection;

  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.name,
      connectTimeout: 5000
    });

    const responseTime = Date.now() - startTime;

    // 执行简单查询验证连接可用
    await connection.execute('SELECT 1');

    return {
      module: 'database',
      name: '数据库直连检查',
      status: 'ok',
      message: `MySQL 连接正常 (${config.host}:${config.port}/${config.name})`,
      responseTime
    };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    return {
      module: 'database',
      name: '数据库直连检查',
      status: 'error',
      message: `MySQL 连接失败: ${err.code || err.message}`,
      responseTime
    };
  } finally {
    if (connection) {
      await connection.end().catch(() => {});
    }
  }
};
