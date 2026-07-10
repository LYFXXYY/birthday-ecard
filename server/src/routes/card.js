// 贺卡访问路由（公开）
// 阶段八：支持文件夹模式（cardId/ 目录下有 index.html）和旧版单文件模式（cardId.html）
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('card');

const router = express.Router();

/**
 * 安全地清理 cardId，防止路径遍历攻击
 */
const sanitizeCardId = (id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return null;
  return path.basename(id);
};

/**
 * 公开访问贺卡页面
 * GET /card/:cardId
 *
 * 阶段八：优先查找 cardId/index.html（文件夹模式），
 * 回退到 cardId.html（旧版单文件模式）
 */
router.get('/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    const safeId = sanitizeCardId(cardId);
    if (!safeId) {
      return res.status(404).json({ code: 404, message: '贺卡不存在或ID格式无效', data: null });
    }

    const resolvedDir = path.resolve(config.cardsDir);

    // 1. 文件夹模式：cardId/index.html
    const resolvedFolder = path.resolve(config.cardsDir, safeId, 'index.html');
    if (resolvedFolder.startsWith(resolvedDir)) {
      try {
        await fs.access(resolvedFolder);
        return res.sendFile(resolvedFolder);
      } catch (_) {
        // 文件夹模式不存在，尝试旧版
      }
    }

    // 2. 旧版单文件模式：cardId.html
    const resolvedLegacy = path.resolve(config.cardsDir, `${safeId}.html`);
    if (resolvedLegacy.startsWith(resolvedDir)) {
      try {
        await fs.access(resolvedLegacy);
        const htmlContent = await fs.readFile(resolvedLegacy, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(htmlContent);
      } catch (_) {
        // 也不存在
      }
    }

    return res.status(404).json({ code: 404, message: '贺卡不存在', data: null });
  } catch (error) {
    logger.error(`访问贺卡失败: ${error.message}`);
    res.status(500).json({ code: 500, message: '访问贺卡失败', data: null });
  }
});

/**
 * 贺卡静态资源（CSS/JS/图片等）
 * 使用子路由 + express.static 服务文件夹内的静态资源
 * Express 5 不支持无名 * 通配符，改用子路由挂载
 */
router.use('/:cardId', (req, res, next) => {
  const { cardId } = req.params;
  const safeId = sanitizeCardId(cardId);
  if (!safeId) return res.status(404).send('Not found');

  const resolvedFolder = path.resolve(config.cardsDir, safeId);
  const resolvedDir = path.resolve(config.cardsDir);

  // 安全检查：确保卡片文件夹在合法目录内
  if (!resolvedFolder.startsWith(resolvedDir)) {
    return res.status(403).send('Forbidden');
  }

  // 使用 express.static 服务卡片文件夹内的静态资源（使用绝对路径）
  const serveStatic = express.static(resolvedFolder);
  serveStatic(req, res, () => {
    // 静态文件未命中，返回 404
    res.status(404).send('Not found');
  });
});

export default router;
