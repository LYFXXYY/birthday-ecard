// tests/utils/constants.test.ts - 职级映射函数测试
// 演示：如何测试一个纯工具函数（前端最简单的测试类型）
//
// 【前端测试的三个层次，由易到难】
// 1. 工具函数测试（本文件）：不依赖 DOM，和后端测试几乎一样，最容易
// 2. 组件测试（见 Login.test.ts）：需要挂载 Vue 组件，中等
// 3. E2E 端到端测试：真实浏览器点击，最复杂，本项目暂未引入

import { describe, it, expect } from 'vitest';
import { getLevelText } from '@/utils/constants';

describe('getLevelText 职级代码转中文', () => {

  // ── 正向用例：每个已知代码都应映射到正确的中文 ──
  it('已知职级代码应返回对应中文', () => {
    expect(getLevelText('management')).toBe('管理层');
    expect(getLevelText('manager')).toBe('三级经理');
    expect(getLevelText('employee')).toBe('普通员工');
    expect(getLevelText('all')).toBe('通用');
  });

  // ── 边界用例：undefined / null / 空字符串 ──
  it('传入 undefined 应返回"未知"', () => {
    expect(getLevelText(undefined)).toBe('未知');
  });

  it('传入 null 应返回"未知"', () => {
    expect(getLevelText(null)).toBe('未知');
  });

  it('传入空字符串应返回"未知"', () => {
    expect(getLevelText('')).toBe('未知');
  });

  // ── 兜底逻辑：未知代码原样返回（便于排查脏数据）──
  it('未知代码应原样返回，方便定位数据问题', () => {
    // 函数设计：map 里没有的，返回原值而不是"未知"
    // （只有传空才返回"未知"）
    expect(getLevelText('some_weird_level')).toBe('some_weird_level');
  });

  // ── 大小写敏感：这是有意为之还是潜在 bug？测试帮你记录现状 ──
  it('当前实现是大小写敏感的（Management 不会被识别）', () => {
    // 如果哪天改成大小写不敏感，这个测试会失败提醒你回归检查
    expect(getLevelText('Management')).toBe('Management');  // 未命中 map，原样返回
  });
});

// 【运行方式】在 admin-web 目录：npm run test
