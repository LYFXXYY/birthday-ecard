// tests/utils/passwordValidator.test.js - 密码复杂度规则测试
// 验证"6位以上 + 含字母 + 含数字"的业务规则
//
// 【这类测试的价值】
// 纯逻辑函数最容易测、最值得测：不依赖数据库、不调网络，毫秒级跑完。
// 规则函数一旦改动（比如把 6 位改成 8 位），测试会立刻告诉你影响了哪些用例。

import { describe, it, expect } from 'vitest';
import { validatePassword } from '../../src/utils/passwordValidator.js';

describe('密码复杂度验证', () => {

  // ── 正向用例：符合规则的密码应该全部通过 ──
  it('合法密码应该通过验证', () => {
    expect(validatePassword('admin123').valid).toBe(true);   // 字母+数字
    expect(validatePassword('abc123456').valid).toBe(true);  // 长密码
  });

  // ── 边界值测试：长度规则（6 位是分界线）──
  it('5 位密码应该被拒绝（长度不足）', () => {
    const result = validatePassword('a1234');  // 5 位
    expect(result.valid).toBe(false);
    expect(result.message).toContain('6位');
  });

  it('6 位密码刚好满足长度要求', () => {
    const result = validatePassword('a12345');  // 6 位
    expect(result.valid).toBe(true);
  });

  // ── 规则组合测试：缺字母 / 缺数字 ──
  it('纯数字密码应该被拒绝（缺字母）', () => {
    const result = validatePassword('123456');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('字母');
  });

  it('纯字母密码应该被拒绝（缺数字）', () => {
    const result = validatePassword('abcdef');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('数字');
  });

  // ── 异常输入测试：健壮性 ──
  it('空值 / 非字符串输入应该被拒绝而不是崩溃', () => {
    expect(validatePassword('').valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
    expect(validatePassword(undefined).valid).toBe(false);
    expect(validatePassword(123456).valid).toBe(false);   // 传了数字不是字符串
    expect(validatePassword(['a1']).valid).toBe(false);   // 传了数组
  });

  // ── 错误提示准确性：每个失败原因对应正确的 message ──
  it('不同失败原因应返回对应的提示信息', () => {
    expect(validatePassword('').message).toBe('密码不能为空');
    expect(validatePassword('a1').message).toBe('密码长度不能少于6位');
    expect(validatePassword('abcdef').message).toBe('密码必须包含至少一个字母'.replace('字母','数字'));  // 纯字母缺数字
    expect(validatePassword('123456').message).toBe('密码必须包含至少一个字母');
  });
});

// 【测试经验】
// 1. 边界值最容易出 bug：规则是"6位以上"，一定要测 5 位和 6 位两个点
// 2. 异常输入（null/undefined/类型错误）保证函数不崩，是接口安全的第一道防线
// 3. 一个 it 里可以放多条断言，但相关断言才放一起，失败了才好定位
