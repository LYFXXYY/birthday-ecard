// 贺卡生成服务（阶段八：多文件文件夹模式）
// 复制模板文件夹 → 递归替换占位符 → 调用视频录制
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';
import { config } from '../config/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('card');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * 格式化生日为中文日期字符串
 */
const formatBirthday = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  } catch {
    return dateStr;
  }
};

/**
 * 递归复制目录
 */
const copyDir = async (src, dest) => {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
};

/**
 * 递归替换文件夹内所有文本文件中的占位符
 */
const replacePlaceholdersInDir = async (dir, replacements) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await replacePlaceholdersInDir(fullPath, replacements);
    } else {
      // 仅处理文本文件
      const textExts = ['.html', '.css', '.js', '.json', '.svg', '.txt'];
      if (textExts.includes(path.extname(entry.name).toLowerCase())) {
        let content = await fs.readFile(fullPath, 'utf-8');
        for (const [placeholder, value] of Object.entries(replacements)) {
          content = content.replaceAll(placeholder, value);
        }
        await fs.writeFile(fullPath, content, 'utf-8');
      }
    }
  }
};

/**
 * 根据模板和员工信息生成贺卡（文件夹模式）
 *
 * @param {object} template - 模板对象（需包含 folder_path 或 html_content）
 * @param {object} employee - 员工对象
 * @returns {Promise<{cardId, cardUrl, cardDir, videoPath, videoUrl}>}
 */
export const generateCard = async (template, employee) => {
  try {
    const cardId = uuidv4();
    const now = new Date();

    // 构建占位符替换表
    const senderName = config.senderName || '公司工会';
    const companyName = config.companyName || senderName;
    const logoUrl = config.logoUrl || '';

    const blessingContent = template.default_blessing?.content || '生日快乐！愿你永远开心如意！';

    const replacements = {
      '{{name}}': employee.name || '',
      '{{position}}': employee.position || '',
      '{{birthday}}': formatBirthday(employee.birthday),
      '{{sender}}': senderName,
      '{{company}}': companyName,
      '{{logo_url}}': logoUrl,
      '{{blessing}}': blessingContent,
      '{{message}}': blessingContent,
      '{{year}}': now.getFullYear().toString(),
      '{{month}}': (now.getMonth() + 1).toString(),
      '{{day}}': now.getDate().toString(),
      '{{music_url}}': '../music/music.mp3'
    };

    // 确定模板源文件夹
    let templateSourceDir;
    if (template.folder_path) {
      // 多文件文件夹模板
      templateSourceDir = path.resolve(DATA_DIR, template.folder_path);
    } else if (template.html_content) {
      // 兼容旧版单文件模板：创建临时文件夹
      templateSourceDir = path.join(config.cardsDir, `_legacy_${cardId}`);
      await fs.mkdir(templateSourceDir, { recursive: true });
      let html = template.html_content;
      for (const [placeholder, value] of Object.entries(replacements)) {
        html = html.replaceAll(placeholder, value);
      }
      await fs.writeFile(path.join(templateSourceDir, 'index.html'), html, 'utf-8');

      // 旧模板直接返回（不录制视频）
      return {
        cardId,
        cardUrl: `/card/${cardId}`,
        cardDir: templateSourceDir,
        videoPath: null,
        videoUrl: null
      };
    } else {
      throw new Error(`模板 ${template.name} 既无 folder_path 也无 html_content`);
    }

    // 1. 复制模板文件夹到 cardsDir（使用 resolve 确保绝对路径，避免 spawn cwd 双重解析）
    const cardDir = path.resolve(config.cardsDir, cardId);
    await copyDir(templateSourceDir, cardDir);

    // 1.5 复制背景音乐到卡片目录（使 {{music_url}} → music.mp3 路径可访问）
    const musicSourcePath = path.join(DATA_DIR, 'music', 'music.mp3');
    const musicDestPath = path.join(cardDir, 'music.mp3');
    try {
      await fs.copyFile(musicSourcePath, musicDestPath);
    } catch (err) {
      logger.warn(`[贺卡生成] 复制音乐文件失败: ${err.message}`);
    }

    // 1.6 复制 logo.svg 到卡片父目录（使模板中 ../logo.svg 引用可访问）
    const logoSourcePath = path.join(DATA_DIR, 'logo.svg');
    const logoDestPath = path.join(config.cardsDir, 'logo.svg');
    try {
      if (fsSync.existsSync(logoSourcePath)) {
        await fs.mkdir(config.cardsDir, { recursive: true });
        await fs.copyFile(logoSourcePath, logoDestPath);
      }
    } catch (err) {
      logger.warn(`[贺卡生成] 复制 logo 文件失败: ${err.message}`);
    }

    // 2. 递归替换占位符（将 {{music_url}} 替换为本地相对路径 music.mp3）
    const musicReplacements = { ...replacements, '{{music_url}}': 'music.mp3' };
    await replacePlaceholdersInDir(cardDir, musicReplacements);

    // 3. 录制视频：调用卡片目录中的 record.js（两遍编码，目标 ≤2MB）
    const videoPath = path.resolve(config.videosDir, `${cardId}.mp4`);
    const recordScript = path.join(cardDir, 'record.js'); // cardDir 已是绝对路径
    let videoSuccess = false;

    if (fsSync.existsSync(recordScript)) {
      logger.info(`[贺卡生成] 调用 record.js 录制视频...`);
      const result = await new Promise((resolve) => {
        const child = spawn(process.execPath, [recordScript, videoPath], {
          cwd: cardDir,
          stdio: ['inherit', 'inherit', 'pipe'], // 捕获 stderr 用于错误诊断
          timeout: 300000 // 5 分钟超时
        });

        let stderr = Buffer.alloc(0);
        if (child.stderr) {
          child.stderr.on('data', (chunk) => {
            stderr = Buffer.concat([stderr, chunk]);
          });
        }

        child.on('error', (err) => {
          resolve({ error: err, signal: null, status: null, stderr });
        });

        child.on('close', (code, signal) => {
          resolve({ error: null, signal, status: code, stderr });
        });
      });

      // 诊断失败原因（优先级：spawn 错误 > 超时 > 信号 > 非零退出码）
      if (result.error) {
        logger.error(`[贺卡生成] record.js 启动失败: ${result.error.message}`);
      } else if (result.signal) {
        logger.error(`[贺卡生成] record.js 被信号 ${result.signal} 终止`);
      } else if (result.status !== 0) {
        const stderrSnippet = result.stderr?.toString('utf-8')
          .split('\n').filter(l => l.trim()).slice(-5).join('\n');
        logger.error(`[贺卡生成] record.js 退出码 ${result.status}，stderr:\n${stderrSnippet}`);
      } else if (!fsSync.existsSync(videoPath)) {
        logger.error(`[贺卡生成] record.js 退出码 0 但视频文件未生成: ${videoPath}`);
      } else if (fsSync.statSync(videoPath).size === 0) {
        logger.error(`[贺卡生成] 视频文件为空: ${videoPath}`);
      } else {
        videoSuccess = true;
        const sizeMB = (fsSync.statSync(videoPath).size / 1000 / 1000).toFixed(2);
        logger.info(`[贺卡生成] 视频录制成功: ${sizeMB}MB`);
      }
    } else {
      logger.warn(`[贺卡生成] 模板无 record.js，跳过视频录制`);
    }

    const videoUrl = videoSuccess ? `/video/${cardId}.mp4` : null;

    return {
      cardId,
      cardUrl: `/card/${cardId}`,
      cardDir,
      videoPath: videoSuccess ? videoPath : null,
      videoUrl,
      videoAttempted: true
    };
  } catch (error) {
    logger.error(`贺卡生成失败: ${error.message}`);
    throw error;
  }
};
