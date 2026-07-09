// 模板种子工具（阶段八：支持文件夹模板 + 兼容旧版 HTML 文件）
// 扫描 src/data/ 下的文件夹（多文件模板）和 .html 文件（旧版单文件模板）
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Template from '../models/Template.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// 已知文件夹模板清单
const FOLDER_MANIFEST = [
  {
    folder: 'birthday-card-15-executive-private-banquet',
    name: '城市私享夜宴',
    description: '高管专属贺卡，城市夜景与私享晚宴主题，7页全屏沉浸式体验',
    page_count: 7,
    employee_level: 'management'
  }
];

// 旧版 HTML 文件清单（兼容保留）
const HTML_MANIFEST = [
  { file: '蛋糕.html', name: '蛋糕', description: '蛋糕主题贺卡，含蜡烛动画与许愿互动，温馨浪漫风格', match_gender: 'all' },
  { file: '粉色.html', name: '粉色', description: '粉色浪漫主题贺卡，含玫瑰花瓣飘落与蛋糕动画，适合女性员工', match_gender: 'female' },
  { file: '礼盒.html', name: '礼盒', description: '礼盒惊喜主题贺卡，含礼盒打开动画与彩带特效，喜庆大方', match_gender: 'all' },
  { file: '派对.html', name: '派对', description: '生日派对主题贺卡，含气球海洋与庆祝彩带动画，活泼欢快', match_gender: 'all' },
  { file: '星光.html', name: '星光', description: '星光璀璨主题贺卡，含大星星闪烁与夜空动画，简约温馨', match_gender: 'all' },
  { file: '红礼盒.html', name: '红礼盒', description: '红金喜庆礼盒主题贺卡，中国风浓郁，适合重要节日与长辈', match_gender: 'all' },
  { file: '寿桃.html', name: '寿桃', description: '寿桃祝寿主题贺卡，传统中式寿宴风格，适合年长员工', match_gender: 'all' },
  { file: '烟花.html', name: '烟花', description: '烟花绚烂主题贺卡，含全屏烟花绽放动画，华丽喜庆', match_gender: 'all' },
  { file: '通用1.html', name: '通用1', description: '简约通用贺卡（风格一），清新淡雅，含蛋糕与祝福文字', match_gender: 'all' },
  { file: '通用2.html', name: '通用2', description: '华丽通用贺卡（风格二），金色装饰与烟花背景，高端大气', match_gender: 'all' },
  { file: '通用3.html', name: '通用3', description: '高级质感贺卡（风格三），暗色调+金色点缀，含粒子特效与自动翻页，内嵌实景照片与背景音乐', match_gender: 'all' }
];

// 旧名称迁移映射
const NAME_MIGRATION = {
  '青年女性模板': '珊瑚·青春女', '青年男性模板': '青蓝·青春男',
  '壮年女性模板': '樱花·轻熟女', '壮年男性模板': '天蓝·轻熟男',
  '中年女性模板': '紫韵·雅致女', '中年男性模板': '沉稳·雅致男',
  '金色通用模板': '喜庆·通用', '粉色女性模板': '粉甜·女性',
  '蓝色男性模板': '蔚蓝·男性', '金色通用模板(详细版)': '金辉·通用',
  '生日邀请函模板': '烟花邀请', 'mb2': '赛博风格', 'mb3': '缤纷派对',
  'mb4': '经典邀请函', 'mb4shotao': '简约邀请函',
  'mb5lihe': '礼盒邀请函', 'mb6yanhua': '烟花邀请函'
};

/**
 * 获取文件夹模板的缩略图路径
 * 优先取 assets/generated/01-cover-bg.png
 */
const getThumbnail = async (folderPath) => {
  const candidates = [
    'assets/generated/01-cover-bg.png',
    'assets/generated/01-cover-bg.jpg',
    'assets/cover.png',
    'thumbnail.png'
  ];
  for (const candidate of candidates) {
    const fullPath = path.join(folderPath, candidate);
    if (fsSync.existsSync(fullPath)) return candidate;
  }
  return null;
};

/**
 * 从文件夹内 index.html 读取页面数量（通过 window.screenOrder 数组长度推断）
 */
const detectPageCount = async (folderPath) => {
  const scriptPath = path.join(folderPath, 'script.js');
  if (!fsSync.existsSync(scriptPath)) return 4;
  try {
    const content = await fs.readFile(scriptPath, 'utf-8');
    const match = content.match(/screenOrder\s*=\s*\[([^\]]*)\]/);
    if (match) {
      const items = match[1].split(',').filter(s => s.trim());
      return items.length || 4;
    }
  } catch (_) {}
  return 4;
};

const initDefaultTemplate = async () => {
  let created = 0, updated = 0, skipped = 0, failed = 0;

  // 读取 data/ 目录内容
  let dirEntries;
  try {
    dirEntries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  } catch (err) {
    console.error(`[模板] 无法读取目录 ${DATA_DIR}:`, err.message);
    return;
  }

  // 名称迁移
  for (const [oldName, newName] of Object.entries(NAME_MIGRATION)) {
    try {
      const oldRecord = await Template.findOne({ where: { name: oldName } });
      if (oldRecord) {
        const exists = await Template.findOne({ where: { name: newName } });
        if (!exists) {
          await oldRecord.update({ name: newName });
          console.log(`[模板] 名称迁移: ${oldName} → ${newName}`);
        }
      }
    } catch (err) {
      console.warn(`[模板] 名称迁移失败: ${oldName} → ${newName}:`, err.message);
    }
  }

  // ── 处理文件夹模板 ──
  const folders = dirEntries.filter(e => e.isDirectory() && !['music', '背景图'].includes(e.name));

  for (const dirEntry of folders) {
    const folderName = dirEntry.name;
    const folderPath = path.join(DATA_DIR, folderName);

    // 检查是否有 index.html
    const indexPath = path.join(folderPath, 'index.html');
    if (!fsSync.existsSync(indexPath)) {
      continue; // 跳过没有 index.html 的目录
    }

    // 查找清单中的元数据
    const manifestEntry = FOLDER_MANIFEST.find(m => m.folder === folderName);
    const name = manifestEntry?.name || folderName;
    const description = manifestEntry?.description || `自动发现的文件夹模板: ${folderName}`;
    const pageCount = manifestEntry?.page_count || await detectPageCount(folderPath);
    const employeeLevel = manifestEntry?.employee_level || 'all';
    const thumbnail = await getThumbnail(folderPath);

    try {
      const existing = await Template.findOne({ where: { name } });
      if (existing) {
        // 文件夹模板：按 folder_path 判断内容是否变化
        if (existing.folder_path === folderName && existing.thumbnail === thumbnail) {
          skipped++;
          continue;
        }
        await existing.update({
          folder_path: folderName,
          thumbnail,
          page_count: pageCount,
          employee_level: employeeLevel,
          description
        });
        updated++;
        console.log(`[模板] 已更新(文件夹): ${name}`);
      } else {
        await Template.create({
          name,
          description,
          folder_path: folderName,
          thumbnail,
          page_count: pageCount,
          employee_level: employeeLevel,
          match_gender: 'all',
          is_active: true,
          html_content: null
        });
        created++;
        console.log(`[模板] 已创建(文件夹): ${name}`);
      }
    } catch (err) {
      failed++;
      console.error(`[模板] ${name} 处理失败:`, err.message);
    }
  }

  // ── 处理旧版 HTML 文件（兼容） ──
  const htmlFiles = dirEntries.filter(e => e.isFile() && e.name.endsWith('.html'));

  for (const fileEntry of htmlFiles) {
    const fileName = fileEntry.name;
    const manifestEntry = HTML_MANIFEST.find(m => m.file === fileName);
    const name = manifestEntry?.name || path.basename(fileName, '.html');
    const description = manifestEntry?.description || `自动发现的模板: ${name}`;

    try {
      const filePath = path.join(DATA_DIR, fileName);
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      const existing = await Template.findOne({ where: { name } });

      if (existing) {
        if (existing.html_content === htmlContent && !existing.folder_path) {
          skipped++;
          continue;
        }
        await existing.update({
          html_content: htmlContent,
          description: manifestEntry?.description || existing.description,
          match_gender: manifestEntry?.match_gender || existing.match_gender
        });
        updated++;
        console.log(`[模板] 已更新(HTML): ${name}`);
      } else {
        await Template.create({
          name,
          description,
          match_gender: manifestEntry?.match_gender || 'all',
          html_content: htmlContent,
          is_active: true
        });
        created++;
        console.log(`[模板] 已创建(HTML): ${name}`);
      }
    } catch (err) {
      failed++;
      console.error(`[模板] ${name} 处理失败:`, err.message);
    }
  }

  console.log(`[模板] 初始化完成 - 新建:${created} 更新:${updated} 跳过:${skipped} 失败:${failed}`);
};

export default initDefaultTemplate;
