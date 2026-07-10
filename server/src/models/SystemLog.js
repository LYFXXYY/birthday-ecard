import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SystemLog = sequelize.define('SystemLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  level: {
    type: DataTypes.ENUM('info', 'warn', 'error'),
    allowNull: false,
    defaultValue: 'info'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  message: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'system_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    { fields: ['level'] },
    { fields: ['category'] },
    { fields: ['created_at'] }
  ]
});

export default SystemLog;
