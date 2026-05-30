# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

工会生日彩信和电子贺卡系统 - 在员工生日当天自动发送包含个性化电子贺卡链接的彩信/短信。

**开发者身份**：大二计算机专业学生，正在学习全栈开发，代码需要学习友好。

**责任分工**：
- 后端开发：API实现、数据库设计、定时任务、贺卡生成逻辑
- 前端开发：管理后台界面、贺卡展示页面实现

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Frontend | Vue 3 + Element Plus + Vite |
| Database | MySQL + Sequelize ORM |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| Scheduling | node-cron |
| Excel Import | xlsx (SheetJS) |
| Deployment | Windows Server |

## Architecture

项目采用前后端分离架构：

- **server/** - 后端Express API服务，包含models、routes、middlewares、services
- **admin-web/** - Vue 3前端管理后台
- **generated-cards/** - 动态生成的贺卡HTML文件存储目录
- 贺卡展示页面为纯HTML/CSS/JS实现，不依赖Vue框架

## Development Commands (To Be Implemented)

项目初始化后，预期使用以下命令：

```bash
# Backend (server/)
npm install          # 安装后端依赖
npm run dev          # 开发模式启动（nodemon）
npm start            # 生产模式启动
npm test             # 运行测试（待实现）

# Frontend (admin-web/)
npm install          # 安装前端依赖
npm run dev          # Vite开发服务器
npm run build        # 生产构建
npm run preview      # 预览生产构建
npm run lint         # ESLint检查（待配置）
```

## Key Technical Points

### Backend Development
- 使用Sequelize ORM操作MySQL，定义模型在`models/`目录
- 路由按模块划分：`auth.js`、`employees.js`、`templates.js`、`records.js`
- 定时任务服务`scheduler.js`每日08:00检查生日员工
- 模板匹配服务`templateMatcher.js`按优先级：手动指定 > 性别+年龄 > 性别 > 通用模板
- 贺卡生成服务`cardGenerator.js`替换占位符生成HTML文件
- 所有API使用统一响应格式，JWT认证保护管理接口

### Frontend Development
- 使用Pinia管理用户状态（token存储）
- axios配置请求拦截器添加JWT认证头
- 路由守卫控制页面访问权限
- Element Plus Form组件处理表单验证

### Birthday Card Template
- 贺卡模板使用纯HTML/CSS/JS，无Vue依赖
- 支持占位符替换：`{{name}}`、`{{department}}`、`{{blessing}}`、`{{year}}`
- 必须适配移动端浏览器（响应式设计）
- 参考现有模板文件`birthday_h5_rebuild.html`的结构和动画实现

## Documentation Guidelines

- 技术设计文档避免包含具体代码示例，保持简洁明了
- 文档内容应适合前端负责人阅读理解
- 内容冲突时需向用户确认后再处理

## API Structure

API接口规范详见技术设计文档，核心接口模块：

- `/api/auth/*` - 认证相关（登录、修改密码）
- `/api/employees/*` - 员工管理（CRUD、批量导入）
- `/api/templates/*` - 模板管理（CRUD、预览）
- `/api/records/*` - 发送记录查询、统计
- `/card/:cardId` - 贺卡公开访问（无需认证）