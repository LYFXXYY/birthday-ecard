import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// 确保环境变量被加载（如果此文件被单独导入）
if (!process.env.DB_HOST) {
  dotenv.config();
}

export const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    timezone: '+08:00',
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      charset: 'utf8mb4'
    },
    define: {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);