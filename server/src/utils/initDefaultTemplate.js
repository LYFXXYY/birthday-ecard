// 模板种子工具 - 将预设模板文件导入数据库
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Template from '../models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// 模板清单：文件名 → 数据库字段
const TEMPLATE_MANIFEST = [
  {
    file: 'template-default.html',
    name: '默认粉色模板',
    description: '粉色温馨风格，适合女性员工',
    match_gender: 'female',
    is_active: true
  },
  {
    file: 'template-male.html',
    name: '蓝色男性模板',
    description: '蓝色沉稳风格，适合男性员工',
    match_gender: 'male',
    is_active: true
  },
  {
    file: 'template-universal.html',
    name: '金色通用模板',
    description: '金色喜庆风格，适合所有员工',
    match_gender: 'all',
    is_active: true
  }
];

const initDefaultTemplate = async () => {
  let created = 0, updated = 0, skipped = 0, failed = 0;

  for (const entry of TEMPLATE_MANIFEST) {
    try {
      const filePath = path.join(DATA_DIR, entry.file);
      const htmlContent = await fs.readFile(filePath, 'utf-8');

      // 按名称查找已有模板
      const existing = await Template.findOne({ where: { name: entry.name } });

      if (existing) {
        // 内容无变化则跳过
        if (existing.html_content === htmlContent) {
          skipped++;
          continue;
        }
        await existing.update({ html_content: htmlContent });
        updated++;
        console.log(`[模板] 已更新: ${entry.name}`);
      } else {
        await Template.create({
          name: entry.name,
          description: entry.description,
          match_gender: entry.match_gender,
          html_content: htmlContent,
          is_active: entry.is_active
        });
        created++;
        console.log(`[模板] 已创建: ${entry.name}`);
      }
    } catch (err) {
      failed++;
      console.error(`[模板] ${entry.name} 处理失败:`, err.message);
    }
  }

  console.log(`[模板] 初始化完成 - 新建:${created} 更新:${updated} 跳过:${skipped} 失败:${failed}`);
};

export default initDefaultTemplate;
