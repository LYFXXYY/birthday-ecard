import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Template } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化默认模板
const initDefaultTemplate = async () => {
  try {
    // 读取默认模板文件
    const templatePath = path.join(__dirname, '../data/default-template.html');
    const htmlContent = await fs.readFile(templatePath, 'utf8');
    
    // 检查是否已存在默认模板
    const existingTemplate = await Template.findOne({ 
      where: { name: '默认生日贺卡模板' } 
    });
    
    if (!existingTemplate) {
      // 创建默认模板
      await Template.create({
        name: '默认生日贺卡模板',
        description: '系统默认的生日贺卡模板',
        match_gender: 'all',
        html_content: htmlContent,
        is_active: true
      });
      
      console.log('[初始化] 默认模板创建成功');
    } else {
      console.log('[初始化] 默认模板已存在');
    }
  } catch (err) {
    console.error('[初始化] 默认模板创建失败:', err.message);
  }
};

export default initDefaultTemplate;