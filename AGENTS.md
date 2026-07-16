# AGENTS.md — AI 智能体交接指南

> 本文件是新会话的首要参考。新智能体应通读全文后开始工作。
> 最后更新：2026-07-16 | 项目版本：v7.2.0

## 1. 项目概况

工会生日彩信和电子贺卡系统 — 信阳移动公司工会委托，在员工生日当天自动发送包含个性化电子贺卡祝福视频的彩信/短信。

**开发者**：大二计算机专业学生，依靠 AI 智能体协作开发。代码需要学习友好。
**客户**：信阳移动公司工会（企业级项目，安全标准要求高）。
**品牌色**：#0085CC（主色）/ #1B83C6 / #95C11F，落款"信阳移动公司工会 敬贺"。

### 1.1 当前状态

- **阶段一~八**：全部完成并验证（数据库、部门管理、等级匹配、操作日志、安全增强、双服务监控、企业主题、视频录制）
- **v7.0.0 功能优化**：Dashboard 重构 + 监控整合、CSP V2.4.3 接口对接、职级名称统一、祝福语匹配升级、投递状态追踪
- **v7.1.0 独立监控**：`server/monitor/` 独立进程，detached spawn，后端崩溃时继续检测
- **v7.2.0 登录修复与安全加固**：修复 JWT base64url 解码导致 token 误判过期（中文 display_name 触发）、CORS 改为白名单模式（localhost + 指定内网 IP）、会话超时实时校验（auth 中间件检查 expires_at 和 last_activity）、恢复登录速率限制（10 次/分钟）
- **阶段九（部署）**：待开发 — PM2 配置、Nginx 示例、备份脚本、部署文档
- **阶段十（测试）**：待开发 — 单元测试、集成测试、安全测试、性能测试

### 1.2 协同开发

- **back 分支**：后端开发（API、数据库、定时任务、贺卡生成、SMS）
- **front 分支**：前端开发（管理后台、贺卡展示）
- **main 分支**：合并目标
- `.gitignore` 已排除 `代码审查与优化总结报告.md` 和 `生日贺卡项目开发文档.md`

## 2. 技术栈

| 层面 | 技术 | 版本/说明 |
|------|------|-----------|
| 后端 | Node.js + Express | 5.x, ES Modules (`"type": "module"`) |
| 前端 | Vue 3 + TypeScript + Element Plus + Vite | Vue 3.4+, Vite 5.4 |
| 数据库 | MySQL + Sequelize ORM | MySQL 8.0+ |
| 认证 | JWT (jsonwebtoken + bcryptjs) | 24h 过期 + active_sessions 追踪 |
| 定时任务 | node-cron | 5字段(分钟级) / 6字段(秒级) |
| SMS | axios + Provider 抽象 | mock/carrier 双模式，CSP V2.4.3 |
| 视频录制 | Playwright + FFmpeg | 贺卡 → MP4 (≤2MB) |
| Excel | xlsx (SheetJS) | 批量导入员工 |
| 监控 | 独立 ESM 子项目 | `server/monitor/`，4 个检测模块 |

## 3. 开发命令

```bash
# 后端 (server/)
npm install          # 安装依赖
npm run dev          # node src/app.js（不用 nodemon）
npm start            # 生产模式

# 前端 (admin-web/)
npm install          # 安装依赖
npm run dev          # Vite 开发服务器 (5173)
npm run build        # 生产构建

# 监控 (server/monitor/) — 随后端自动启动，也可独立运行
node src/app.js
```

**重要**：修改后端代码后必须 `taskkill /f /im node.exe` 杀旧进程再重启（无 nodemon 热重载）。

## 4. 架构概览

```
┌──────────────────────────────────────────────────────┐
│                   服务器                               │
│  ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │  Vue 3 前端  │───>│ Express API │───>│  MySQL DB │ │
│  │ (管理后台)   │    │   (后端)     │    │ (4级部门) │ │
│  │ 左右分栏     │    └──────┬──────┘    └───────────┘ │
│  └─────────────┘    ┌──────┴──────┐                  │
│                     │  发送管道    │    ┌───────────┐ │
│  ┌─────────────┐    │ (贺卡+SMS)  │    │  操作日志  │ │
│  │ 视频录制    │<───┤             │───>│  在线会话  │ │
│  │ (Playwright)│    └──────┬──────┘    └───────────┘ │
│  └─────────────┘           │           ┌───────────┐ │
│                     ┌──────┴──────┐    │  独立监控  │ │
│                     │ 运营商接口   │    │  进程     │ │
│                     │ (CSP+回调)  │<───│ (detached)│ │
│                     └─────────────┘    └───────────┘ │
└──────────────────────────────────────────────────────┘
```

### 4.1 项目目录

```
birthday-card-system/
├── server/
│   ├── src/
│   │   ├── app.js              # 入口（body limit 5mb, migrate→sync→listen）
│   │   ├── config/             # 配置（DB、SMS、carrier-sms.config.js CSP鉴权）
│   │   ├── models/             # 9个模型（Admin/Employee/Template/SendRecord/Blessing/Department/OperationLog/ActiveSession）
│   │   ├── routes/             # 12个路由模块
│   │   ├── middlewares/        # authMiddleware + operationLog + errorHandler
│   │   ├── services/           # scheduler/sendService/cardGenerator/templateMatcher/smsService/heartbeat/monitor/session
│   │   ├── utils/              # JWT/密码校验/Excel解析/DB迁移/模板种子
│   │   └── data/               # 13个模板文件夹 + logo.svg + music/
│   ├── heartbeats/             # 心跳文件（sender.json、monitor.json）
│   ├── monitor/                # 独立监控项目（4检测模块 + 日志清理）
│   ├── generated-cards/        # 运行时贺卡目录
│   └── generated-videos/       # 运行时录制视频
├── admin-web/                  # Vue 3 前端
│   └── src/
│       ├── api/                # API 封装（8个模块）
│       ├── views/              # Dashboard/EmployeeList/TemplateList/SendRecords/BlessingList/OperationLogs等
│       ├── components/         # MainLayout（会话超时+登出）
│       ├── stores/             # Pinia userStore
│       └── router/             # 路由配置
└── uploads/
    └── processTemplates.js     # 模板标准化流水线
```

### 4.2 启动顺序（app.js）

1. `dotenv.config()` — 加载环境变量
2. `migrateDatabase()` — ALTER TABLE 加列（**必须在 sync 之前**）
3. `sequelize.sync()` — CREATE TABLE / CREATE INDEX
4. `initAdmin()` — 创建默认管理员 admin/123456
5. `initDefaultTemplate()` — 扫描 data/ 文件夹 upsert 模板
6. `initSenderHeartbeat()` — 写入初始心跳
7. 注册路由和中间件
8. `app.listen()` — 启动 HTTP 服务
9. `spawnMonitor()` — detached spawn 监控子进程

### 4.3 核心调用链

**定时发送**：scheduler (cron 8:00) → scheduler.processBirthdayEmployees() → templateMatcher → cardGenerator (复制模板+占位符替换+spawnSync录制) → sendService (buildSmsBody+sendSMSWithRetry) → smsService (mock/carrier)

**模板预览**：前端 window.open → GET /:id/preview → 302 重定向 → /api/templates/asset/{folder_path}/ → asset处理器检测目录 → 返回 index.html（所有相对路径自然解析）

**视频录制**：cardGenerator → spawnSync(node, record.js, outputPath) → Playwright录制 → FFmpeg两遍编码 → MP4 ≤2MB

## 5. 数据模型要点

**三级等级体系**：管理层(management) / 三级经理(manager) / 普通员工(employee)

**字段名易混**（三个模型各用不同名称）：
- Employee: `level`
- Template: `employee_level`
- Blessing: `match_employee_level`

**关键关联**：
- Employee → Department: belongsTo, 别名 `dept`（不能用 `department`，与文本字段冲突）
- Template → Blessing: `default_blessing_id`
- Employee → Template: `default_template_id`
- SendRecord → Employee/Template/Admin: 三个 belongsTo

**模板匹配优先级**：1) 手动 default_template_id → 2) 职级按 page_count → 3) 通用(employee_level='all'/null) → 4) 兜底

**发送状态流转**：pending → recording → recorded → sending → success/failed
- 视频录制失败时状态强制 failed（videoAttempted 标志控制）
- delivery_status/delivery_time 由 CSP 回调更新

## 6. 已知陷阱（必读）

### 6.1 Express / Node.js
- Express 5 (path-to-regexp v8+) **不支持无名 `*` 通配符路由**，用 `router.use()` + `express.static` 替代
- ESM 中 `import fs from 'fs/promises'` 不含 `existsSync`，需额外 `import { existsSync } from 'fs'`
- `dotenv.config()` 在 import 之后执行，数据库模块需自行调用 `dotenv.config()`

### 6.2 Sequelize
- `belongsTo` 别名不能与模型已有字段同名（如 Employee 有 `department` 文本字段，关联别名必须用 `dept`）
- `literal()` 在 MySQL 中必须用反引号包裹标识符（`literal('`t`.`col`')`），双引号是 PostgreSQL 语法会报错
- `sequelize.sync()` 不会为已存在的表添加新列，必须用 `migrate.js` 的 ALTER TABLE

### 6.3 贺卡模板
- `package.json` 有 `"type": "module"`，record.js 必须用 ESM 语法
- `config.cardsDir/videosDir` 是相对路径，传给 spawnSync 子进程时必须 `path.resolve()` 转绝对路径
- Playwright 自带 FFmpeg 仅支持 VP8/WebM，完整编解码器须装 `@ffmpeg-installer/ffmpeg`
- chromium.launch() 在 Express 进程内会挂起（事件循环冲突），须 fork()/spawnSync 子进程做浏览器自动化
- record.js 不可覆盖 `.screen` 的 transform（会抽搐），只隐藏 UI 控件

### 6.4 Vue / 前端
- Vue 模板中显示字面量花括号（如 `{{blessing}}`）不能用嵌套 `{{ }}` 写法，需在 script 中定义常量
- Swiper v11+ 导入路径是 `swiper/vue`（不是 `swiper`），模块从 `swiper/modules` 导入
- Element Plus 水平菜单的 el-sub-menu 弹出层 teleported 到 body，scoped 的 :deep() 无法覆盖，需用 popper-class + :global()
- 响应拦截器解包 response.data，API 函数需要显式类型声明避免 TS 推断错误
- **JWT base64url 解码**：`router/index.ts` 的 `isTokenExpired()` 必须先将 base64url 转标准 base64（`-`→`+`、`_`→`/`、补齐 padding）再 `atob()`，否则含中文 display_name 的 token 解码失败被误判过期

### 6.5 开发环境
- 修改后端代码后必须 taskkill 杀旧 Node 进程再重启（无 nodemon）
- CMD 用单斜杠 `taskkill /f /im node.exe`，Git Bash 用双斜杠 `//f`
- 重启前必须先杀占用端口的旧进程，否则新进程绑定失败但不报错

## 7. 模板系统

### 7.1 占位符清单
`{{name}}` `{{department}}` `{{position}}` `{{birthday}}` `{{sender}}` `{{blessing}}` `{{message}}`(同blessing) `{{year_note}}` `{{title}}` `{{music_url}}` `{{company}}` `{{logo_url}}` `{{year}}` `{{month}}` `{{day}}` `{{deptBlock}}`(条件占位符)

### 7.2 模板标准化流水线（processTemplates.js）
输入 `uploads/模板/` → 输出 `uploads/标准模板/` → 复制到 `server/src/data/`
处理步骤：logo替换 → `{{logo_url}}`→`../logo.svg` → 导航栏清理(page-progress|page-dots) → 品牌CSS注入(检测`品牌logo标准化`注释) → 落款去重 → 硬编码落款注入 → startAutoPlaySequence条件暴露 → 文案框居中 → logo放大(44px)

### 7.3 模板资源管理
- Logo 统一放 `server/src/data/logo.svg`，模板通过 `../logo.svg` 引用
- 音乐统一放 `server/src/data/music/music.mp3`
- cardGenerator 将 logo 复制到 `cardsDir` 的父目录（`data/`），不是每个贺卡子目录

## 8. SMS 服务

- Provider 抽象：`mock`（开发）/ `carrier`（生产）
- carrier 模式：中国移动 CSP V2.4.3，XML 请求体 + 双层 SHA256+Base64 鉴权
- `carrier-sms.config.js` 独立配置，每次发送动态加载（不缓存）
- 视频大小分支：≤2MB mmsBodyText / 2-5MB mmsBodyTextLarge
- 100 号码自动分批
- 回调路由：`/api/sms-callback/StatusReportNotification/:chatbotUri`（公开，express.text() 解析 XML）
- 指数退避重试：仅 sendService 一层 3 次（smsService 内部无重试）

## 9. 监控项目（server/monitor/）

- 独立 ESM 项目，不依赖主项目代码
- 四个检测：HTTP(30s) / 端口(60s) / 心跳(60s) / 数据库(300s)
- `detached: true` 脱离后端，后端崩溃时继续检测
- 日志 `monitor/logs/monitor-YYYY-MM-DD.log`，每天 2:00 清理 30 天前
- node-cron 注意：5字段最小粒度分钟，6字段支持秒级，混用会出错

## 10. 安全要求

- API 输入白名单：`sanitizeInput` / `sanitizeEmployeeInput`
- 贺卡 cardId：UUID v4 + `path.basename()` 防路径遍历
- 生产环境 `JWT_SECRET` 必须随机长字符串
- 密码：6位+字母数字，90天到期提醒，首次登录强制修改
- 会话：active_sessions 追踪，auth 中间件实时校验 `expires_at` 和 `last_activity`（30分钟空闲超时），最多3设备并发
- CORS 白名单：`app.js` 中 `ALLOWED_HOSTS` 控制允许的 origin（localhost + 指定内网 IP），支持 `ALLOWED_ORIGINS` 环境变量扩展
- 登录速率限制：10 次/分钟/IP（`auth.js` 的 `loginLimiter`）
- 双重密码验证：敏感操作前二次确认
- 删除全为硬删除，员工删除级联删除发送记录
- 发送管道用 sequelize.transaction() 事务保护

## 11. 前端规范

- 模板编辑是纯文本模式（非 HTML 编辑器）
- v-html 不执行 `<script>`，模板 JS 逻辑需在 Vue 侧字符串模拟
- 祝福语断句：按 `，` `；` 拆分，包 `<span class="comma-line">`
- 上传文件不手动设 Content-Type（让浏览器处理 boundary）
- 路由守卫用 `useUserStore().getToken()`
- 模板预览用 window.open 新标签页（不用 iframe，sandbox 会限制 JS/音乐）
- Excel 导入模板下载是前端纯客户端生成（XLSX库），与后端 generate-import-template.js 是独立实现（已删除），修改时只需改前端

## 12. 日志架构

- log4js 三 appender：console + file + errorFile
- logger.js 根据 NODE_ENV 动态适配：production 仅写文件，development 终端+文件
- LOG_LEVEL 环境变量控制级别
- system_logs 表仅 scheduler 写入，sendService/cardGenerator/smsService 不写数据库
- 操作日志仅覆盖管理员 CRUD

## 13. 文档导航

| 文档 | 内容 |
|------|------|
| **README.md** | 项目简介、快速启动、文档索引 |
| **生日贺卡项目开发文档.md** | 完整技术设计：架构、数据库、API、前端指南 |
| **项目指南.md** | 新手教程：环境准备、启动步骤、功能使用 |
| **代码审查与优化总结报告.md** | 122 个问题的发现与修复详情（v1.0 ~ v7.1.0） |
| **部署指南.md** | 部署技术介绍 + Windows/Linux 部署流程 |

## 14. 待开发（阶段九/十）

**阶段九 — 部署与环境兼容**：
- PM2 ecosystem.config.js
- Nginx 反向代理配置
- MySQL 定期备份脚本
- 文件路径跨平台兼容验证
- 部署文档（含 Windows 和 Linux）

**阶段十 — 测试与收尾**：
- 核心业务逻辑单元测试（sendService、templateMatcher、sanitizeInput）
- API 接口集成测试
- 安全测试（密码策略、会话管理、并发限制）
- 性能测试（大量员工批量发送）
