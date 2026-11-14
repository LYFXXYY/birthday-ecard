// tests/utils/jwt.test.js - JWT 令牌工具测试
// 测试 token 生成和验证（jsonwebtoken）
//
// 【JWT 基础概念】
// JWT = JSON Web Token，由三部分组成：header.payload.signature
// - header: 算法类型（如 HS256）
// - payload: 实际数据（用户 ID、过期时间等）
// - signature: 用密钥生成的签名，防篡改
// 本项目用 JWT 做登录认证，token 有效期 24 小时

import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken, verifyToken } from '../../src/utils/jwt.js';
import { config } from '../../src/config/index.js';

describe('JWT 工具函数', () => {

  // 测试 1: 正常生成 token
  it('应该生成有效的 JWT token', () => {
    const payload = { id: 1, username: 'admin', display_name: '系统管理员' };
    const token = generateToken(payload);

    // JWT 格式：三段用 . 分隔的 base64url 字符串
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  // 测试 2: 验证自己签发的 token（核心流程）
  it('生成的 token 应该能通过验证并还原数据', () => {
    const payload = { id: 42, username: 'testuser' };
    const token = generateToken(payload);

    const decoded = verifyToken(token);

    // payload 中的字段应该原样保留
    expect(decoded.id).toBe(42);
    expect(decoded.username).toBe('testuser');
  });

  // 测试 3: 过期时间自动注入
  it('token 应该包含签发时间(iat)和过期时间(exp)', () => {
    const token = generateToken({ id: 1 });
    const decoded = verifyToken(token);

    expect(decoded.iat).toBeTypeOf('number');  // 签发时间戳
    expect(decoded.exp).toBeTypeOf('number');  // 过期时间戳
    // 过期时间应该晚于签发时间
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  // 测试 4: 含中文的 payload（回归测试！）
  // 【重要】这是 v7.2.0 修复的 bug 的测试：
  // 之前前端用 atob() 直接解码 base64url 会失败，导致中文用户名的 token
  // 被误判为过期。后端签名/验证本身没问题，这里确保中文 payload 正常工作
  it('应该正确处理含中文的 payload（base64url 编码）', () => {
    const payload = { id: 1, display_name: '系统管理员' };  // 中文
    const token = generateToken(payload);

    const decoded = verifyToken(token);
    expect(decoded.display_name).toBe('系统管理员');
  });

  // 测试 5: 篡改的 token 必须被拒绝（安全检查）
  it('应该拒绝被篡改的 token', () => {
    const token = generateToken({ id: 1, username: 'admin' });

    // 手动修改 payload 部分（模拟攻击者篡改）
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.username = 'hacker';  // 篡改数据
    parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = parts.join('.');

    // 验证应该抛异常（签名不匹配）
    expect(() => verifyToken(tamperedToken)).toThrow();
  });

  // 测试 6: 伪造密钥的 token 必须被拒绝
  it('应该拒绝用其他密钥签发的 token', () => {
    // 用错误的密钥伪造一个 token
    const fakeToken = jwt.sign({ id: 1, username: 'admin' }, 'wrong_secret');

    expect(() => verifyToken(fakeToken)).toThrow();
  });

  // 测试 7: 过期 token 必须被拒绝
  it('应该拒绝已过期的 token', () => {
    // 签发一个已过期的 token（-1 秒 = 立即过期）
    const expiredToken = jwt.sign(
      { id: 1 },
      config.jwt.secret,
      { expiresIn: '-1s' }
    );

    expect(() => verifyToken(expiredToken)).toThrow(/expired/i);
  });
});

// 【小结：JWT 测试要点】
// 1. 正向：生成 → 验证 → 数据一致
// 2. 安全：篡改、伪造、过期都必须拒绝
// 3. 回归：中文等特殊字符的编码问题（本项目踩过坑）
