/**
 * 贺卡文件清理工具 - 统一删除磁盘上的贺卡目录和视频文件
 *
 * 供 routes/employees.js 和 routes/records.js 共用，避免重复代码。
 */
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { getLogger } from './logger.js';

const logger = getLogger('cleanup');

/**
 * 清理指定 cardId 对应的所有磁盘文件
 * 包括：贺卡目录、MP4 视频、旧版 WebM 视频、旧版单文件 HTML
 *
 * @param {string} cardId - 贺卡 ID
 */
export async function cleanupCardFiles(cardId) {
  if (!cardId) return;

  const cardsDir = path.resolve(config.cardsDir);
  const videosDir = path.resolve(config.videosDir);

  // 清理贺卡文件夹
  const cardDir = path.join(cardsDir, cardId);
  try {
    await fs.rm(cardDir, { recursive: true, force: true });
    logger.info(`[清理] 删除贺卡目录: ${cardDir}`);
  } catch (err) {
    logger.warn(`[清理] 删除贺卡目录失败: ${cardDir} - ${err.message}`);
  }

  // 清理 MP4 视频文件
  const videoPath = path.join(videosDir, `${cardId}.mp4`);
  try {
    await fs.unlink(videoPath);
    logger.info(`[清理] 删除视频文件: ${videoPath}`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[清理] 删除视频文件失败: ${videoPath} - ${err.message}`);
    }
  }

  // 兼容旧版 WebM 视频文件
  const legacyVideoPath = path.join(videosDir, `${cardId}.webm`);
  try {
    await fs.unlink(legacyVideoPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[清理] 删除旧版视频文件失败: ${legacyVideoPath} - ${err.message}`);
    }
  }

  // 兼容旧版单文件 HTML
  const legacyPath = path.join(cardsDir, `${cardId}.html`);
  try {
    await fs.unlink(legacyPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      logger.warn(`[清理] 删除旧版 HTML 文件失败: ${legacyPath} - ${err.message}`);
    }
  }
}
