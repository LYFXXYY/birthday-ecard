import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const Blessing = sequelize.define('Blessing', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  match_gender: {
    type: DataTypes.ENUM('male', 'female', 'all'),
    defaultValue: 'all'
  },
  match_age_min: {
    type: DataTypes.INTEGER
  },
  match_age_max: {
    type: DataTypes.INTEGER
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'blessings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export default Blessing;
