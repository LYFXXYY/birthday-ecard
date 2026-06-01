import dotenv from 'dotenv';

// 确保环境变量被加载（如果此文件被单独导入）
if (!process.env.DB_HOST) {
  dotenv.config();
}

const jwtSecret = process.env.JWT_SECRET || 'default_secret_change_in_production';
const nodeEnv = process.env.NODE_ENV || 'development';

// 生产环境安全警告
if (nodeEnv === 'production' && jwtSecret === 'default_secret_change_in_production') {
  console.error('[安全警告] JWT_SECRET 使用默认值！生产环境必须设置强密钥！');
  console.error('[安全警告] 请在 .env 文件中设置 JWT_SECRET 为一个至少32字符的随机字符串');
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  cardsDir: process.env.CARDS_DIR || './generated-cards',
  uploadsDir: process.env.UPLOADS_DIR || './uploads'
};
