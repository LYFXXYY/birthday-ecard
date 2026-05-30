// 贺卡访问路由（公开）
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

const router = express.Router();

/**
 * 安全地清理cardId，防止路径遍历攻击
 */
const sanitizeCardId = (id) => {
  // UUID格式验证 (v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) return null;
  
  // 提取纯文件名部分，防止目录遍历
  return path.basename(`${id}.html`);
};

/**
 * 公开访问贺卡页面
 * GET /card/:cardId
 */
router.get('/:cardId', async (req, res) => {
  try {
    const { cardId } = req.params;
    
    // 清理和验证cardId
    const safeFileName = sanitizeCardId(cardId);
    if (!safeFileName) {
      return res.status(404).json({
        code: 404,
        message: '贺卡不存在或ID格式无效',
        data: null
      });
    }
    
    // 构造文件路径（使用dirname作为基础目录）
    const filePath = path.join(config.cardsDir, safeFileName);
    const resolvedPath = path.resolve(filePath);
    const resolvedDir = path.resolve(config.cardsDir);
    
    // 安全检查：确保文件在允许的目录内
    if (!resolvedPath.startsWith(resolvedDir)) {
      return res.status(403).json({
        code: 403,
        message: '禁止访问',
        data: null
      });
    }
    
    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({
        code: 404,
        message: '贺卡不存在',
        data: null
      });
    }
    
    // 返回HTML文件内容
    const htmlContent = await fs.readFile(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(htmlContent);
  } catch (error) {
    console.error('访问贺卡失败:', error.message);
    res.status(500).json({
      code: 500,
      message: '访问贺卡失败',
      data: null
    });
  }
});

export default router;
