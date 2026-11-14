// tests/api/auth.test.js - 登录接口集成测试
// 用 supertest 直接请求真实的 Express 应用（不启动端口，不发真实网络请求）
//
// 【集成测试 vs 单元测试】
// - 单元测试：只测一个函数（如上面的密码工具测试），快、隔离
// - 集成测试：测多个模块协作（路由→中间件→数据库），更接近真实场景
//
// 【前置条件】
// 本测试连接的是 .env 中配置的真实 MySQL 数据库（birthday 库）。
// 运行前确保：1) MySQL 已启动  2) 服务器至少启动过一次（表和 admin 账号已初始化）
//
// 【测试凭据】集成测试依赖真实数据，密码一改测试就会挂，所以凭据从环境变量读：
//   运行方式：TEST_ADMIN_PASSWORD=你的实际密码 npx vitest run tests/api
//   或在 server/ 下建 .env.test 文件写入 TEST_ADMIN_PASSWORD=xxx（记得加进 .gitignore）
//   默认值 '123456' 仅适用于全新初始化的数据库。
// 注意：登录成功会往 active_sessions 表写会话记录，属正常现象。

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

// 测试用的管理员凭据（可用环境变量覆盖）
const TEST_USERNAME = process.env.TEST_ADMIN_USERNAME || 'admin';
const TEST_PASSWORD = process.env.TEST_ADMIN_PASSWORD || '123456';
// 是否显式提供了密码：没提供时，依赖真实登录的正向用例会跳过（避免默认密码不符导致误报）
const hasCredentials = Boolean(process.env.TEST_ADMIN_PASSWORD);

let app;

beforeAll(async () => {
  // 动态导入 app（import 时会执行启动逻辑，但不 listen 端口）
  // 注意：app.js 顶层会调用 startServer()，测试环境下让它自然完成初始化
  const mod = await import('../../src/app.js');
  app = mod.default;
});

describe('POST /api/auth/login 登录接口', () => {

  // ── 正向流程：正确凭证登录成功（需通过 TEST_ADMIN_PASSWORD 提供真实密码，否则跳过）──
  it.skipIf(!hasCredentials)('正确的用户名密码应该返回 200 和 token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(200);
    expect(res.body.message).toBe('登录成功');

    // data 结构完整性检查
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.username).toBe(TEST_USERNAME);
    // token 是三段式 JWT
    expect(res.body.data.token.split('.')).toHaveLength(3);
  });

  // ── 安全测试：错误密码 ──
  it('错误密码应该返回 401，且不泄露账号是否存在', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: 'wrong_password_xyz' });

    expect(res.status).toBe(401);
    // 【安全要点】提示语统一为"用户名或密码错误"，
    // 不能提示"密码错误"（否则攻击者可枚举出哪些用户名存在）
    expect(res.body.message).toBe('用户名或密码错误');
  });

  // ── 安全测试：不存在的用户 ──
  it('不存在的用户名应该返回同样的 401 提示', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody_9999', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('用户名或密码错误');  // 与密码错误时一致
  });

  // ── 异常输入：缺少字段 ──
  it('缺少 username 或 password 字段不应导致服务器崩溃', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin' });  // 少了 password

    // 服务器应该正常响应（401 或 400），而不是 500
    expect(res.status).toBeLessThan(500);
  });

  it('空请求体不应导致 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBeLessThan(500);
  });
});

describe('GET /api/auth/profile 获取当前用户', () => {

  // 【测试辅助函数】先登录拿到 token，供后续认证请求使用
  const getAuthToken = async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD });
    return res.body.data.token;
  };

  // ── 认证中间件测试：无 token 必须拒绝 ──
  it('不带 token 应该返回 401', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  // ── 认证中间件测试：伪造 token 必须拒绝 ──
  it('伪造的 token 应该返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', 'Bearer fake.token.here');
    expect(res.status).toBe(401);
  });

  // ── 正向流程：有效 token 可访问（需真实登录，未提供凭据时跳过）──
  it.skipIf(!hasCredentials)('携带有效 token 应该返回用户信息', async () => {
    const token = await getAuthToken();

    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(TEST_USERNAME);
    // 【安全要点】返回的数据不能包含密码哈希
    expect(res.body.data).not.toHaveProperty('password_hash');
  });
});

describe('GET /api/health 健康检查', () => {
  it('应该返回 200 和数据库连接状态', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.database).toBe('connected');
  });
});

// 【集成测试注意事项】
// 1. 测试会真实读写数据库 —— 生产库上别跑，用开发库
// 2. 用例之间尽量独立，不依赖执行顺序（这里每个用例自己登录取 token）
// 3. 限流提醒：登录接口 10 次/分钟/IP，用例多了可能触发 429，
//    可在 .env 设 NODE_ENV=development 时放宽，或减少登录类用例数量
