import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const SendRecord = sequelize.define('SendRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id'
    }
  },
  template_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'templates',
      key: 'id'
    }
  },
  card_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  card_id: {
    type: DataTypes.STRING(100)
  },
  send_status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    defaultValue: 'pending'
  },
  send_time: {
    type: DataTypes.DATE
  },
  admin_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'admins',
      key: 'id'
    }
  },
  error_message: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'send_records',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

export default SendRecord;