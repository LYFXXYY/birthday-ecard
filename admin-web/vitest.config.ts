// vitest.config.ts - 前端测试框架配置
// 前端测试用 jsdom 模拟浏览器环境（因为组件需要 DOM 才能渲染）
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  // 复用 Vue 插件，让测试能识别 .vue 单文件组件
  plugins: [vue()],
  resolve: {
    // 和 vite.config.ts 保持一致的路径别名，测试里才能用 @/xxx 导入
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,            // 全局 API
    environment: 'jsdom',     // 模拟浏览器 DOM 环境（组件测试必需）
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
