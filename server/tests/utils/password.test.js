// tests/utils/password.test.js - 密码工具函数测试
// 测试密码加密和验证功能（bcryptjs）
// 
// 【测试基础概念】
// - describe(): 测试套件，把相关测试分组
// - it() 或 test(): 单个测试用例，描述"应该做什么"
// - expect(): 断言，检查实际结果是否符合预期
// - toBe(), toMatch(), toBeTrue(): 不同的断言匹配器

import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../src/utils/password.js';

describe('密码工具函数', () => {
  
  // 测试 1: 密码加密功能
  it('应该正确加密密码', async () => {
    const password = 'admin123';
    const hash = await hashPassword(password);
    
    // 断言 1: 加密后的哈希值不等于原文（安全性检查）
    expect(hash).not.toBe(password);
    
    // 断言 2: bcrypt 哈希以 $2b$ 或 $2a$ 开头（格式检查）
    expect(hash).toMatch(/^\$2[aby]\$/);
    
    // 断言 3: 哈希长度通常为 60 字符
    expect(hash.length).toBe(60);
  });

  // 测试 2: 密码验证功能（核心）
  it('应该正确验证匹配的密码', async () => {
    const password = 'test123456';
    const hash = await hashPassword(password);
    
    // 用原始密码验证加密后的哈希
    const isMatch = await comparePassword(password, hash);
    
    expect(isMatch).toBe(true);  // 应该匹配
  });

  // 测试 3: 错误密码拒绝
  it('应该拒绝错误的密码', async () => {
    const correctPassword = 'admin123';
    const wrongPassword = 'wrong456';
    
    const hash = await hashPassword(correctPassword);
    const isMatch = await comparePassword(wrongPassword, hash);
    
    expect(isMatch).toBe(false);  // 不应该匹配
  });

  // 测试 4: 不同密码生成不同哈希（盐值检查）
  it('同一密码两次加密应生成不同哈希（因盐值随机）', async () => {
    const password = 'same123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    // 两个哈希值不同（盐值随机）
    expect(hash1).not.toBe(hash2);
    
    // 但都能验证通过原始密码
    expect(await comparePassword(password, hash1)).toBe(true);
    expect(await comparePassword(password, hash2)).toBe(true);
  });

  // 测试 5: 边界情况 - 空字符串
  it('应该处理空密码（虽然实际业务中会被前端验证拦截）', async () => {
    const emptyPassword = '';
    const hash = await hashPassword(emptyPassword);
    const isMatch = await comparePassword('', hash);
    
    expect(isMatch).toBe(true);  // bcrypt 技术上支持空字符串
  });

  // 测试 6: 边界情况 - 超长密码
  it('应该处理超长密码（bcrypt 限制 72 字节）', async () => {
    const longPassword = 'a'.repeat(100);
    const hash = await hashPassword(longPassword);
    
    // 注意：bcrypt 只使用前 72 字节，超长部分被忽略
    const isMatch72 = await comparePassword('a'.repeat(72), hash);
    expect(isMatch72).toBe(true);
  });
});

// 【如何运行这个测试】
// 1. 在项目根目录运行: npm run test
// 2. 监听模式（文件改动自动重跑）: npm run test:watch
// 3. 生成覆盖率报告: npm run test:coverage
