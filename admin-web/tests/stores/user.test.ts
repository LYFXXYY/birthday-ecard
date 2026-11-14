// tests/stores/user.test.ts - Pinia 用户状态管理测试
// 演示：如何测试 Pinia store（登录态、token 存取、清除）
//
// 【为什么测 store】
// store 是前端的状态中枢，登录/登出/权限判断都依赖它。
// 它不涉及 DOM，逻辑清晰，是组件测试之外最值得测的部分。
//
// 【关键技术点】
// - localStorage：store 会读写它，jsdom 环境自带模拟，测试间要手动清干净
// - setActivePinia：测试里用 Pinia 必须先激活一个实例

import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from '@/stores/user';

describe('用户 store', () => {

  // 每个测试前：激活全新的 Pinia + 清空 localStorage，保证用例互不干扰
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  // ── 初始状态 ──
  it('初始状态应为未登录（无 token、无用户信息）', () => {
    const store = useUserStore();
    expect(store.getToken()).toBe('');
    expect(store.userInfo).toBeNull();
  });

  // ── 设置 token ──
  it('setToken 应同时更新内存和 localStorage', () => {
    const store = useUserStore();
    store.setToken('my-test-token');

    expect(store.getToken()).toBe('my-test-token');
    // 验证真的写进了 localStorage（刷新页面后能恢复的关键）
    expect(localStorage.getItem('token')).toBe('my-test-token');
  });

  // ── 设置用户信息 ──
  it('setUserInfo 应存储用户对象并可读取', () => {
    const store = useUserStore();
    const user = { id: 1, username: 'admin', display_name: '系统管理员' };
    store.setUserInfo(user);

    expect(store.userInfo).toEqual(user);
    // localStorage 里是 JSON 字符串
    expect(JSON.parse(localStorage.getItem('userInfo')!)).toEqual(user);
  });

  // ── 清除认证（登出核心逻辑）──
  it('clearAuth 应彻底清除内存和 localStorage 的登录信息', () => {
    const store = useUserStore();
    store.setToken('token-to-clear');
    store.setUserInfo({ id: 1, username: 'admin', display_name: 'x' });

    store.clearAuth();

    expect(store.getToken()).toBe('');
    expect(store.userInfo).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('userInfo')).toBeNull();
  });

  // ── 持久化恢复：模拟页面刷新 ──
  it('页面刷新后应从 localStorage 恢复登录态', () => {
    // 模拟上一个会话写入的登录数据
    localStorage.setItem('token', 'persisted-token');
    localStorage.setItem('userInfo', JSON.stringify({ id: 2, username: 'u', display_name: '用户' }));

    // 重新创建 store（模拟刷新后 store 重新初始化，initAuth 会自动跑）
    setActivePinia(createPinia());
    const store = useUserStore();

    expect(store.getToken()).toBe('persisted-token');
    expect(store.userInfo?.id).toBe(2);
  });

  // ── 脏数据健壮性 ──
  it('localStorage 里 userInfo 是坏 JSON 时不应崩溃', () => {
    localStorage.setItem('userInfo', '{不是合法的JSON');
    // 重新初始化 store，initAuth 应捕获解析异常而不是抛出
    setActivePinia(createPinia());
    const store = useUserStore();

    // 坏数据被忽略，userInfo 保持 null，而不是让页面白屏
    expect(store.userInfo).toBeNull();
  });
});
