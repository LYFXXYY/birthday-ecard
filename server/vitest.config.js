// vitest.config.js - 后端测试框架配置
// Vitest 是 Vite 生态的测试框架，兼容 Jest API，原生支持 ESM
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,        // 全局 API（describe, it, expect 不用 import）
    environment: 'node',  // Node.js 环境（非浏览器）
    coverage: {
      provider: 'v8',     // 覆盖率统计工具
      reporter: ['text', 'html'],  // 终端 + HTML 报告
    },
  },
});
