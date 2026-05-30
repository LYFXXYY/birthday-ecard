// 贺卡生成服务
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';

/**
 * 根据模板和员工信息生成个性化贺卡
 */
export const generateCard = async (template, employee) => {
  try {
    // 读取模板HTML内容
    let html = template.html_content;
    
    // 生成祝福语（简化版本，实际可更复杂）
    const blessings = [
      `生日快乐！愿你永远开心如意！`,
      `祝你生日快乐，身体健康，工作顺利！`,
      `愿你的每一天都充满阳光和欢笑！`,
      `生日快乐！愿你心想事成，万事如意！`
    ];
    const blessing = blessings[Math.floor(Math.random() * blessings.length)];

    // 替换占位符
    const replacements = {
      '{{name}}': employee.name,
      '{{department}}': employee.department || '',
      '{{blessing}}': blessing,
      '{{year}}': new Date().getFullYear().toString()
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      html = html.replaceAll(placeholder, value);
    }

    // 生成唯一ID
    const cardId = uuidv4();
    
    // 保存HTML文件
    const filePath = path.join(config.cardsDir, `${cardId}.html`);
    await fs.writeFile(filePath, html, 'utf-8');
    
    return {
      cardId,
      cardUrl: `${config.baseUrl}/card/${cardId}`
    };
  } catch (error) {
    console.error('贺卡生成失败:', error);
    throw error;
  }
};