import Admin from './Admin.js';
import Employee from './Employee.js';
import Template from './Template.js';
import Blessing from './Blessing.js';
import SendRecord from './SendRecord.js';
import { sequelize } from '../config/database.js';

// 建立模型关系
Admin.hasMany(SendRecord, { foreignKey: 'admin_id', as: 'records' });
SendRecord.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });

Employee.hasMany(SendRecord, { foreignKey: 'employee_id', as: 'records' });
SendRecord.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

Template.hasMany(SendRecord, { foreignKey: 'template_id', as: 'records' });
SendRecord.belongsTo(Template, { foreignKey: 'template_id', as: 'template' });

Template.belongsTo(Blessing, { foreignKey: 'default_blessing_id', as: 'default_blessing' });
Blessing.hasMany(Template, { foreignKey: 'default_blessing_id', as: 'templates' });

Template.hasMany(Employee, { foreignKey: 'default_template_id', as: 'employees' });
Employee.belongsTo(Template, { foreignKey: 'default_template_id', as: 'default_template' });

export { sequelize, Admin, Employee, Template, Blessing, SendRecord };