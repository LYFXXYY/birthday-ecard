import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// TODO: department 文本字段与 department_id 外键存在双写不一致风险
// 长期计划：迁移为仅使用 department_id，department 文本字段标记为 deprecated
const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  gender: {
    type: DataTypes.ENUM('male', 'female'),
    allowNull: false
  },
  birthday: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  department: {
    type: DataTypes.STRING(100)
  },
  department_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'departments',
      key: 'id'
    }
  },
  department_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  level: {
    type: DataTypes.ENUM('management', 'manager', 'employee'),
    defaultValue: 'employee'
  },
  position: {
    type: DataTypes.STRING(100)
  },
  default_template_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'templates',
      key: 'id'
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'employees',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['birthday'] },
    { fields: ['department_id'] },
    { fields: ['level'] },
    { fields: ['phone'] }
  ]
});

export default Employee;