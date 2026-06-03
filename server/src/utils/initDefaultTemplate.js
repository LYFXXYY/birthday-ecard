// 模板种子工具 - 将预设模板文件导入数据库
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Template from '../models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// 模板清单：文件名 → 数据库字段（含年龄段匹配规则）
const TEMPLATE_MANIFEST = [
  {
    file: 'template-youth-female.html',
    name: '青年女性模板',
    description: '珊瑚粉橘风格，适合18-30岁女性员工',
    match_gender: 'female',
    match_age_min: 18,
    match_age_max: 30,
    is_active: true
  },
  {
    file: 'template-youth-male.html',
    name: '青年男性模板',
    description: '青蓝科技风格，适合18-30岁男性员工',
    match_gender: 'male',
    match_age_min: 18,
    match_age_max: 30,
    is_active: true
  },
  {
    file: 'template-young-female.html',
    name: '壮年女性模板',
    description: '粉红浪漫风格，适合30-45岁女性员工',
    match_gender: 'female',
    match_age_min: 31,
    match_age_max: 45,
    is_active: true
  },
  {
    file: 'template-young-male.html',
    name: '壮年男性模板',
    description: '天蓝清新风格，适合30-45岁男性员工',
    match_gender: 'male',
    match_age_min: 31,
    match_age_max: 45,
    is_active: true
  },
  {
    file: 'template-middle-female.html',
    name: '中年女性模板',
    description: '紫色优雅风格，适合45-65岁女性员工',
    match_gender: 'female',
    match_age_min: 46,
    match_age_max: 65,
    is_active: true
  },
  {
    file: 'template-middle-male.html',
    name: '中年男性模板',
    description: '深蓝沉稳风格，适合45-65岁男性员工',
    match_gender: 'male',
    match_age_min: 46,
    match_age_max: 65,
    is_active: true
  },
  {
    file: 'template-universal.html',
    name: '金色通用模板',
    description: '金色喜庆风格，适合所有员工（兜底模板）',
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
          match_age_min: entry.match_age_min || null,
          match_age_max: entry.match_age_max || null,
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
