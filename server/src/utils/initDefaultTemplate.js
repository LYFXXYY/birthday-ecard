// 模板种子工具
// 扫描 src/data/ 下的文件夹（多文件模板），自动发现并入库
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Template from '../models/Template.js';
import { getLogger } from './logger.js';

const logger = getLogger('template');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// 旧名称迁移映射（数据库中存在旧名称模板时自动重命名）
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
    logger.error(`[模板] 无法读取目录 ${DATA_DIR}: ${err.message}`);
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
          logger.info(`[模板] 名称迁移: ${oldName} → ${newName}`);
        }
      }
    } catch (err) {
      logger.warn(`[模板] 名称迁移失败: ${oldName} → ${newName}: ${err.message}`);
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

    // 使用文件夹名作为模板名，自动检测页数
    const name = folderName;
    const description = `自动发现的文件夹模板: ${folderName}`;
    const pageCount = await detectPageCount(folderPath);
    const employeeLevel = 'all';
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
        logger.info(`[模板] 已更新(文件夹): ${name}`);
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
        logger.info(`[模板] 已创建(文件夹): ${name}`);
      }
    } catch (err) {
      failed++;
      logger.error(`[模板] ${name} 处理失败: ${err.message}`);
    }
  }

  logger.info(`[模板] 初始化完成 - 新建:${created} 更新:${updated} 跳过:${skipped} 失败:${failed}`);
};

export default initDefaultTemplate;
