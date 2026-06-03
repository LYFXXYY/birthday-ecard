// 模板种子工具 - 将预设模板文件导入数据库
// 支持自动发现：src/data/ 下新增的 HTML 文件会自动入库，无需手动添加清单
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Template from '../models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// 已知模板清单：提供详细的元数据（名称、描述、匹配规则）
// 如果文件在此清单中，使用清单中的元数据；否则自动从文件名生成
const TEMPLATE_MANIFEST = [
  {
    file: 'template-youth-female.html',
    name: '青年女性模板',
    description: '珊瑚粉橘风格，适合18-30岁女性员工',
    match_gender: 'female',
    match_age_min: 18,
    match_age_max: 30
  },
  {
    file: 'template-youth-male.html',
    name: '青年男性模板',
    description: '青蓝科技风格，适合18-30岁男性员工',
    match_gender: 'male',
    match_age_min: 18,
    match_age_max: 30
  },
  {
    file: 'template-young-female.html',
    name: '壮年女性模板',
    description: '粉红浪漫风格，适合30-45岁女性员工',
    match_gender: 'female',
    match_age_min: 31,
    match_age_max: 45
  },
  {
    file: 'template-young-male.html',
    name: '壮年男性模板',
    description: '天蓝清新风格，适合30-45岁男性员工',
    match_gender: 'male',
    match_age_min: 31,
    match_age_max: 45
  },
  {
    file: 'template-middle-female.html',
    name: '中年女性模板',
    description: '紫色优雅风格，适合45-65岁女性员工',
    match_gender: 'female',
    match_age_min: 46,
    match_age_max: 65
  },
  {
    file: 'template-middle-male.html',
    name: '中年男性模板',
    description: '深蓝沉稳风格，适合45-65岁男性员工',
    match_gender: 'male',
    match_age_min: 46,
    match_age_max: 65
  },
  {
    file: 'template-universal.html',
    name: '金色通用模板',
    description: '金色喜庆风格，适合所有员工（兜底模板）',
    match_gender: 'all'
  },
  {
    file: 'index.html',
    name: '粉色女性模板',
    description: '粉色浪漫风格，适合女性员工',
    match_gender: 'female'
  },
  {
    file: 'male.html',
    name: '蓝色男性模板',
    description: '蓝色简洁风格，适合男性员工',
    match_gender: 'male'
  },
  {
    file: 'universal.html',
    name: '金色通用模板(详细版)',
    description: '金色精致风格，包含部门职位信息，适合所有员工',
    match_gender: 'all'
  },
  {
    file: 'mb1.html',
    name: '生日邀请函模板',
    description: '烟花动画风格的生日邀请函（不含占位符）',
    match_gender: 'all'
  }
];

/**
 * 从文件名自动生成模板元数据
 * 例如: "my-cool-template.html" → { name: "my-cool-template", description: "自动发现的模板: my-cool-template", match_gender: "all" }
 */
const generateMetaFromFilename = (filename) => {
  const nameWithoutExt = path.basename(filename, '.html');
  return {
    name: nameWithoutExt,
    description: `自动发现的模板: ${nameWithoutExt}`,
    match_gender: 'all'
  };
};

const initDefaultTemplate = async () => {
  let created = 0, updated = 0, skipped = 0, failed = 0;

  // 第一步：构建文件名 → 元数据的映射
  const manifestMap = new Map();
  for (const entry of TEMPLATE_MANIFEST) {
    manifestMap.set(entry.file, entry);
  }

  // 第二步：扫描 src/data/ 目录，发现所有 HTML 文件
  let allHtmlFiles = [];
  try {
    const dirEntries = await fs.readdir(DATA_DIR);
    allHtmlFiles = dirEntries.filter(f => f.endsWith('.html'));
  } catch (err) {
    console.error(`[模板] 无法读取目录 ${DATA_DIR}:`, err.message);
    return;
  }

  if (allHtmlFiles.length === 0) {
    console.log('[模板] src/data/ 目录为空，跳过模板初始化');
    return;
  }

  // 第三步：合并清单 —— 已知模板用清单元数据，新文件自动生成元数据
  const allEntries = [];
  for (const file of allHtmlFiles) {
    if (manifestMap.has(file)) {
      allEntries.push(manifestMap.get(file));
    } else {
      const autoMeta = generateMetaFromFilename(file);
      allEntries.push({ file, ...autoMeta });
      console.log(`[模板] 发现新文件（自动入库）: ${file}`);
    }
  }

  // 第四步：逐个处理入库（幂等 upsert：按名称查找，有则更新，无则创建）
  for (const entry of allEntries) {
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
        await existing.update({
          html_content: htmlContent,
          // 同时更新描述和匹配规则（以清单为准）
          description: entry.description || existing.description,
          match_gender: entry.match_gender || existing.match_gender,
          match_age_min: entry.match_age_min || null,
          match_age_max: entry.match_age_max || null
        });
        updated++;
        console.log(`[模板] 已更新: ${entry.name}`);
      } else {
        await Template.create({
          name: entry.name,
          description: entry.description || '',
          match_gender: entry.match_gender || 'all',
          match_age_min: entry.match_age_min || null,
          match_age_max: entry.match_age_max || null,
          html_content: htmlContent,
          is_active: true
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
