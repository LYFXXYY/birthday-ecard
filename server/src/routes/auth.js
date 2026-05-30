import { Router } from 'express';
import { sequelize, Admin } from '../models/index.js';
import { success, error } from '../utils/response.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// POST /api/auth/login - 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const admin = await Admin.findOne({ where: { username } });
    if (!admin) {
      return error(res, '用户名或密码错误', 401);
    }

    // 验证密码
    const isValid = await comparePassword(password, admin.password_hash);
    if (!isValid) {
      return error(res, '用户名或密码错误', 401);
    }

    // 生成token
    const token = generateToken({
      id: admin.id,
      username: admin.username,
      display_name: admin.display_name
    });

    success(res, {
      token,
      user: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name
      }
    }, '登录成功');
  } catch (err) {
    error(res, err.message);
  }
});

// GET /api/auth/profile - 获取当前用户信息（需要认证）
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.user.id, {
      attributes: ['id', 'username', 'display_name']
    });

    if (!admin) {
      return error(res, '管理员不存在', 404);
    }

    success(res, admin);
  } catch (err) {
    error(res, err.message);
  }
});

// POST /api/auth/change-password - 修改密码（需要认证）
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const admin = await Admin.findByPk(req.user.id);
    const isValid = await comparePassword(oldPassword, admin.password_hash);

    if (!isValid) {
      return error(res, '原密码错误', 400);
    }

    const password_hash = await hashPassword(newPassword);
    await Admin.update({ password_hash }, { where: { id: req.user.id } });

    success(res, null, '密码修改成功');
  } catch (err) {
    error(res, err.message);
  }
});

export default router;