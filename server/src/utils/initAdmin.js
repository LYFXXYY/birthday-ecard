// 初始化默认管理员
import { Admin } from '../models/index.js';
import { hashPassword } from './password.js';
import { getLogger } from './logger.js';

const logger = getLogger('init');

const initDefaultAdmin = async () => {
  try {
    // 检查是否已存在管理员
    const count = await Admin.count();
    
    if (count === 0) {
      // 创建默认管理员
      const password_hash = await hashPassword('123456');
      
      await Admin.create({
        username: 'admin',
        password_hash,
        display_name: '系统管理员'
      });
      
      logger.info('[初始化] 默认管理员创建成功 (username: admin, password: 123456)');
    } else {
      logger.info('[初始化] 管理员已存在，跳过创建');
    }
  } catch (err) {
    logger.error(`[初始化失败] ${err.message}`);
  }
};

// 在app.js中导入此函数并调用
export default initDefaultAdmin;