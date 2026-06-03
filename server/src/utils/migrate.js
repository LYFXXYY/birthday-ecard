// 数据库迁移工具 - 确保已存在的表拥有新增列
// sequelize.sync() 不会为已存在的表添加新列，此工具弥补该缺陷
import { sequelize } from '../config/database.js';
import { QueryTypes } from 'sequelize';

const MIGRATIONS = [
  // send_records 表的 SMS 追踪字段（后续版本新增）
  {
    table: 'send_records',
    column: 'message_id',
    sql: "ALTER TABLE send_records ADD COLUMN message_id VARCHAR(200) NULL"
  },
  {
    table: 'send_records',
    column: 'sms_provider',
    sql: "ALTER TABLE send_records ADD COLUMN sms_provider VARCHAR(20) NULL"
  },
  {
    table: 'send_records',
    column: 'retry_count',
    sql: "ALTER TABLE send_records ADD COLUMN retry_count INT DEFAULT 0"
  },
  {
    table: 'templates',
    column: 'default_blessing_id',
    sql: "ALTER TABLE templates ADD COLUMN default_blessing_id INT NULL"
  }
];

const migrateDatabase = async () => {
  let applied = 0;

  for (const migration of MIGRATIONS) {
    try {
      // 检查列是否已存在
      const [results] = await sequelize.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ? AND COLUMN_NAME = ?
      `, {
        replacements: [migration.table, migration.column],
        type: QueryTypes.SELECT
      });

      if (!results) {
        await sequelize.query(migration.sql);
        applied++;
        console.log(`[迁移] 已添加列: ${migration.table}.${migration.column}`);
      }
    } catch (err) {
      // 忽略错误（表不存在等情况）
      console.warn(`[迁移] ${migration.table}.${migration.column} 跳过: ${err.message}`);
    }
  }

  if (applied > 0) {
    console.log(`[迁移] 完成，共应用 ${applied} 项迁移`);
  }
};

export default migrateDatabase;
