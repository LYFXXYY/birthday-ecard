import dotenv from 'dotenv';

// 确保环境变量被加载（如果此文件被单独导入）
if (!process.env.DB_HOST) {
  dotenv.config();
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  cardsDir: process.env.CARDS_DIR || './generated-cards',
  uploadsDir: process.env.UPLOADS_DIR || './uploads'
};
