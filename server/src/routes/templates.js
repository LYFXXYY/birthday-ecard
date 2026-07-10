import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { success, error } from '../utils/response.js';
import { authMiddleware } from '../middlewares/auth.js';
import { Template, Blessing, Employee, SendRecord } from '../models/index.js';
import { autoAssignBlessingToTemplate, pickRandomUniversalBlessing } from '../services/autoMatch.js';
import { logOperation, extractLogInfo } from '../middlewares/operationLog.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('template');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// ========== 公开路由：静态文件服务（不需要认证） ==========
// 这些路由被 <img src="..."> 直接访问，浏览器不会携带 Authorization 头
const publicRouter = Router();

// GET /api/templates/:id/thumbnail - 通过模板 ID 获取缩略图
publicRouter.get('/:id/thumbnail', async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id);
    if (!template || !template.folder_path || !template.thumbnail) {
      return res.status(404).send('Not found');
    }

    const fullPath = path.join(DATA_DIR, template.folder_path, template.thumbnail);
    const resolvedFull = path.resolve(fullPath);
    const resolvedData = path.resolve(DATA_DIR);

    if (!resolvedFull.startsWith(resolvedData)) {
      return res.status(403).send('Forbidden');
    }

    await fs.access(resolvedFull);
    res.sendFile(resolvedFull);
  } catch (err) {
    res.status(404).send('Not found');
  }
});

// GET /api/templates/thumbnail/:folderPath/* - 提供模板缩略图文件
publicRouter.use('/thumbnail/:folderPath', async (req, res, next) => {
  try {
    const folderPath = req.params.folderPath;
    const remainingPath = req.url.substring(1);
    const fullPath = remainingPath
      ? path.join(DATA_DIR, folderPath, remainingPath)
      : path.join(DATA_DIR, folderPath);
    const resolvedFull = path.resolve(fullPath);
    const resolvedData = path.resolve(DATA_DIR);

    if (!resolvedFull.startsWith(resolvedData)) {
      return res.status(403).send('Forbidden');
    }

    await fs.access(resolvedFull);
    res.sendFile(resolvedFull);
  } catch (err) {
    res.status(404).send('Not found');
  }
});

// GET /api/templates/asset/:folderPath/* - 提供模板文件夹内的静态资源
publicRouter.use('/asset/:folderPath', async (req, res, next) => {
  try {
    const folderPath = req.params.folderPath;
    const remainingPath = req.url.substring(1);
    const fullPath = remainingPath
      ? path.join(DATA_DIR, folderPath, remainingPath)
      : path.join(DATA_DIR, folderPath);
    const resolvedFull = path.resolve(fullPath);
    const resolvedData = path.resolve(DATA_DIR);

    if (!resolvedFull.startsWith(resolvedData)) {
      return res.status(403).send('Forbidden');
    }

    await fs.access(resolvedFull);
    res.sendFile(resolvedFull);
  } catch (err) {
    res.status(404).send('Not found');
  }
});

// ========== 认证路由：需要登录才能访问 ==========
const router = Router();
router.use(authMiddleware);

/**
 * 白名单过滤：防止mass assignment攻击
 * 只允许更新模型的合法字段
 */
const TEMPLATE_FIELDS = [
  'name', 'description', 'folder_path', 'thumbnail', 'is_active',
  'default_blessing_id', 'employee_level', 'page_count'
];

const sanitizeInput = (obj) => {
  const sanitized = {};
  for (const key of TEMPLATE_FIELDS) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

// ========== 静态路径路由（必须在 /:id 之前定义） ==========

// GET /api/templates - 获取模板列表（不返回html_content）
router.get('/', async (req, res) => {
  try {
    const templates = await Template.findAll({
      attributes: ['id', 'name', 'description', 'folder_path', 'thumbnail', 'page_count', 'employee_level', 'default_blessing_id', 'is_active', 'created_at'],
      include: [{
        model: Blessing,
        as: 'default_blessing',
        attributes: ['id', 'content']
      }]
    });
    success(res, templates);
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/templates/folder-assets - 获取模板文件夹内的素材列表
router.get('/folder-assets', async (req, res) => {
  try {
    const { folder_path } = req.query;
    if (!folder_path) {
      return error(res, '缺少 folder_path 参数', 400);
    }

    const templateDir = path.join(DATA_DIR, folder_path);
    const resolvedDir = path.resolve(templateDir);
    const resolvedData = path.resolve(DATA_DIR);

    if (!resolvedDir.startsWith(resolvedData)) {
      return error(res, '无效的文件夹路径', 403);
    }

    const entries = await fs.readdir(resolvedDir, { withFileTypes: true });
    const assets = [];

    // 递归收集所有文件（含子目录）
    const collectFiles = async (dir, relativeBase) => {
      const items = await fs.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const relativePath = relativeBase ? `${relativeBase}/${item.name}` : item.name;
        if (item.isDirectory()) {
          await collectFiles(path.join(dir, item.name), relativePath);
        } else {
          const ext = path.extname(item.name).toLowerCase();
          const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
          assets.push({
            name: item.name,
            relativePath,
            url: `/api/templates/asset/${folder_path}/${relativePath}`,
            isImage,
            size: (await fs.stat(path.join(dir, item.name))).size
          });
        }
      }
    };

    await collectFiles(resolvedDir, '');

    success(res, assets);
  } catch (err) {
    logger.error(`[folder-assets] Error: ${err.message}`);
    error(res, err.message, 500);
  }
});

// POST /api/templates/backfill-blessings - 回填祝福语
router.post('/backfill-blessings', async (req, res) => {
  try {
    const unmatched = await Template.findAll({
      where: { default_blessing_id: null, is_active: true }
    });

    if (unmatched.length === 0) {
      return success(res, { updated: 0 }, '所有模板均已匹配祝福语');
    }

    let updated = 0;
    for (const tpl of unmatched) {
      const blessing = await pickRandomUniversalBlessing();
      if (blessing) {
        await tpl.update({ default_blessing_id: blessing.id });
        updated++;
      }
    }

    success(res, { updated }, `已为 ${updated} 个模板补配祝福语`);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/templates - 新增模板
router.post('/', async (req, res) => {
  try {
    const template = await Template.create(sanitizeInput(req.body));
    await autoAssignBlessingToTemplate(template);
    const result = await Template.findByPk(template.id, {
      include: [{ model: Blessing, as: 'default_blessing', attributes: ['id', 'content'] }]
    });
    logOperation({ ...extractLogInfo(req), action: 'create', model: 'Template', model_id: template.id, details: { name: template.name } });
    success(res, result, '添加成功');
  } catch (err) {
    error(res, err.message);
  }
});

// ========== 动态参数路由 /:id ==========

// GET /api/templates/:id - 获取模板详情
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });

    if (!template) {
      return error(res, '模板不存在', 404);
    }

    success(res, template);
  } catch (err) {
    error(res, err.message);
  }
});

// PUT /api/templates/:id - 修改模板
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Template.update(
      sanitizeInput(req.body),
      { where: { id: req.params.id } }
    );

    if (!updated) {
      return error(res, '模板不存在', 404);
    }

    logOperation({ ...extractLogInfo(req), action: 'update', model: 'Template', model_id: parseInt(req.params.id), details: sanitizeInput(req.body) });
    success(res, null, '修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

// DELETE /api/templates/:id - 删除模板
router.delete('/:id', async (req, res) => {
  try {
    const refCount = await Employee.count({ where: { default_template_id: req.params.id } });
    if (refCount > 0) {
      await Employee.update({ default_template_id: null }, { where: { default_template_id: req.params.id } });
      logger.info(`[模板] 已解除 ${refCount} 位员工的默认模板关联`);
    }

    const recordCount = await SendRecord.count({ where: { template_id: req.params.id } });
    if (recordCount > 0) {
      await SendRecord.update({ template_id: null }, { where: { template_id: req.params.id } });
      logger.info(`[模板] 已解除 ${recordCount} 条发送记录的模板关联`);
    }

    const template = await Template.findByPk(req.params.id);
    const deleted = await Template.destroy({ where: { id: req.params.id } });

    if (!deleted) {
      return error(res, '模板不存在', 404);
    }

    logOperation({ ...extractLogInfo(req), action: 'delete', model: 'Template', model_id: parseInt(req.params.id), details: { name: template?.name } });
    success(res, null, refCount > 0 ? `删除成功，已解除 ${refCount} 位员工的关联` : '删除成功');
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/templates/:id/preview - 预览模板渲染效果
router.get('/:id/preview', async (req, res) => {
  try {
    const template = await Template.findByPk(req.params.id, {
      include: [{ model: Blessing, as: 'default_blessing' }]
    });

    if (!template) {
      return error(res, '模板不存在', 404);
    }

    const now = new Date();
    const replacements = {
      '{{name}}': '张三',
      '{{department}}': '技术部',
      '{{position}}': '工程师',
      '{{birthday}}': '6月15日',
      '{{sender}}': '公司工会',
      '{{company}}': '公司工会',
      '{{logo_url}}': '',
      '{{blessing}}': template.default_blessing?.content || '祝你生日快乐，万事如意！',
      '{{title}}': '张三的生日贺卡',
      '{{year}}': now.getFullYear().toString(),
      '{{month}}': (now.getMonth() + 1).toString(),
      '{{day}}': now.getDate().toString(),
      '{{music_url}}': '../music/music.mp3',
      '{{message}}': '恭祝您生日快乐，愿您事业蒸蒸日上，生活幸福美满！',
      '{{year_note}}': '岁序更新，美好常在'
    };

    if (template.folder_path) {
      const templateDir = path.join(DATA_DIR, template.folder_path);
      const indexPath = path.join(templateDir, 'index.html');

      try {
        let html = await fs.readFile(indexPath, 'utf-8');
        for (const [placeholder, value] of Object.entries(replacements)) {
          html = html.replaceAll(placeholder, value);
        }
        res.type('text/html').send(html);
      } catch (err) {
        return error(res, '模板文件夹内 index.html 读取失败: ' + err.message, 500);
      }
      return;
    }

    if (!template.html_content) {
      return error(res, '模板无可预览内容', 400);
    }

    let html = template.html_content;
    for (const [placeholder, value] of Object.entries(replacements)) {
      html = html.replaceAll(placeholder, value);
    }

    res.type('text/html').send(html);
  } catch (err) {
    error(res, err.message, 500);
  }
});

// ========== 合并路由：公开路由在前（优先匹配），认证路由在后 ==========
const combinedRouter = Router();
combinedRouter.use(publicRouter);
combinedRouter.use(router);

export default combinedRouter;
