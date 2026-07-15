import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173, // 前端开发服务器端口（避开 Hyper-V 保留段 5041-5242）
    open: true, // 自动打开浏览器
    cors: true, // 允许跨域
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 后端服务器地址
        changeOrigin: true, // 允许跨域
        secure: false // 如果是 https 接口，需要配置这个参数
        // 注意：不要 rewrite，后端路由本身就带 /api 前缀
      },
      '/uploads': {
        target: 'http://localhost:3000', // 后端服务器（静态文件）
        changeOrigin: true
      },
      '/video': {
        target: 'http://localhost:3000', // 视频文件
        changeOrigin: true
      },
      '/card': {
        target: 'http://localhost:3000', // 贺卡文件
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 分包策略
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          elementPlus: ['element-plus'],
          axios: ['axios']
        },
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]'
      }
    }
  }
})