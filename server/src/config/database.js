// ESM 静态 import 会被提升先于模块体执行，app.js 的 dotenv.config() 在本模块之后才运行。
// 因此数据库模块必须自行加载 .env，确保 process.env 中有数据库连接参数。
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { Sequelize } from 'sequelize';

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
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
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