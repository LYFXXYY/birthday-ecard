import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
// TODO: Element Plus 当前为全量导入，后续可迁移为按需导入以减小打包体积
// 迁移步骤：1) npm install -D unplugin-vue-components unplugin-auto-import
// 2) 在 vite.config.ts 中添加对应插件  3) 移除此处的全量 import
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './style.css'

// 创建应用实例
const app = createApp(App)

// 创建Pinia实例
const pinia = createPinia()

// 使用插件
app.use(pinia)
app.use(router)
app.use(ElementPlus)

// 挂载应用
app.mount('#app')
