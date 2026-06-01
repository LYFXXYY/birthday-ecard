# 生日彩信系统 Postman 测试指南

> 版本: v2.1.0 | 更新时间: 2026-06-01

---

## 0. 项目启动教程（IDEA + 浏览器）

### 0.1 环境准备

在开始之前，确保你的电脑已安装以下软件：

| 软件 | 最低版本 | 说明 | 验证命令 |
|------|----------|------|----------|
| Node.js | 18.x+ | JavaScript 运行时 | `node -v` |
| npm | 9.x+ | 包管理器（随 Node.js 安装） | `npm -v` |
| MySQL | 8.0+ | 关系型数据库 | `mysql --version` |
| IntelliJ IDEA | 2023.x+ | 开发工具 | - |
| 浏览器 | Chrome/Edge | 前端访问 | - |

> 提示：在终端中输入验证命令检查是否已安装。如未安装，先完成安装再继续。

### 0.2 项目结构

```
birthday-card-system/
├── server/          # 后端服务（Node.js + Express，端口 3000）
└── admin-web/       # 前端管理后台（Vue 3 + Vite，端口 5173）
```

项目是前后端分离架构，**后端和前端需要分别启动**，各自占用一个终端窗口。

### 0.3 第一步：创建 MySQL 数据库

1. 打开 MySQL 客户端（命令行或 Navicat 等工具）
2. 执行以下 SQL 创建数据库：

```sql
CREATE DATABASE birthday DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

> 不需要手动建表，后端启动时 Sequelize ORM 会自动创建所有数据表。

### 0.4 第二步：用 IDEA 打开项目

1. 打开 IntelliJ IDEA
2. 选择 **File → Open**，选择 `birthday-card-system` 文件夹
3. 等待 IDEA 索引完成（右下角进度条消失）

### 0.5 第三步：配置后端环境变量

1. 在 IDEA 左侧项目树中，展开 `server/` 目录
2. 复制 `.env.example` 文件，重命名为 `.env`
3. 双击打开 `.env`，**必须修改以下配置**：

```env
# 把 your_database_password 改成你的 MySQL 密码
DB_PASSWORD=你的MySQL密码

# 把下面这行改成一个随机字符串（至少32个字符，随便打一串字母数字即可）
JWT_SECRET=改成你自己的随机密钥字符串至少32个字符
```

其他配置保持默认即可（开发环境不需要修改）。

### 0.6 第四步：安装后端依赖并启动

1. 在 IDEA 底部点击 **Terminal**（终端）标签
2. 输入以下命令，进入 server 目录并安装依赖：

```bash
cd server
npm install
```

3. 等待安装完成（会出现 `added xxx packages` 提示）
4. 启动后端服务：

```bash
npm run dev
```

5. 看到以下输出表示**后端启动成功**：

```
服务器运行在 http://localhost:3000
数据库连接成功
默认管理员账户已初始化（admin/123456）
定时任务已启动：每天 08:00 检查生日员工
```

> **不要关闭这个终端窗口！** 后端服务需要持续运行。

### 0.7 第五步：打开第二个终端，启动前端

1. 在 IDEA 终端标签旁边，点击 **+** 号新建一个终端（或按 `Alt+F12` 打开新终端）
2. 输入以下命令，进入前端目录并安装依赖：

```bash
cd admin-web
npm install
```

3. 等待安装完成后，启动前端开发服务器：

```bash
npm run dev
```

4. 看到以下输出表示**前端启动成功**：

```
  VITE v5.4.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://xxx.xxx.xxx.xxx:5173/
```

> 前端启动后通常会**自动打开浏览器**。如果没有自动打开，手动在浏览器中访问 `http://localhost:5173`。

### 0.8 第六步：在浏览器中使用

1. 浏览器打开 `http://localhost:5173`，你会看到登录页面
2. 使用默认管理员账号登录：
   - **用户名**：`admin`
   - **密码**：`123456`
3. 登录成功后进入仪表盘页面，说明前后端都已正常运行

#### 核心功能使用说明

| 功能 | 菜单位置 | 说明 |
|------|----------|------|
| 仪表盘 | 首页 | 显示员工总数、模板数、发送统计 |
| 员工管理 | 左侧菜单 → 员工管理 | 增删改查员工信息 |
| 批量导入 | 员工管理页 → 导入按钮 | 上传 Excel/CSV 文件批量导入 |
| 模板管理 | 左侧菜单 → 模板管理 | 管理贺卡 HTML 模板 |
| 模板预览 | 模板列表 → 预览按钮 | 在新窗口查看模板渲染效果 |
| 生成贺卡 | 员工列表 → 发送按钮 | 手动为员工生成贺卡 |
| 发送记录 | 左侧菜单 → 发送记录 | 查看历史发送记录和统计 |

### 0.9 日常启动流程（快速参考）

每次使用项目时，按以下顺序操作：

```
1. 确保 MySQL 服务正在运行
2. IDEA 打开项目
3. 终端1：cd server → npm run dev        （启动后端）
4. 终端2：cd admin-web → npm run dev     （启动前端）
5. 浏览器访问 http://localhost:5173
```

### 0.10 常见启动问题排查

| 问题现象 | 原因 | 解决方法 |
|---------|------|----------|
| 前端白屏/空白页，Console 有红色错误 | 残留 Node 进程占用端口导致冲突 | 打开任务管理器，结束所有 `node.exe` 进程，然后重新启动 |
| `Error: listen EADDRINUSE :::3000` | 后端端口 3000 被占用 | 任务管理器中结束 `node.exe`，或修改 `.env` 中的 `PORT` |
| `Error: listen EADDRINUSE :::5173` | 前端端口 5173 被占用 | 任务管理器中结束 `node.exe`，或在终端执行 `npx kill-port 5173` |
| `Access denied for user 'root'@'localhost'` | MySQL 密码错误 | 检查 `.env` 中 `DB_PASSWORD` 是否正确 |
| `Unknown database 'birthday'` | 数据库未创建 | 执行第三步的 CREATE DATABASE 语句 |
| `npm install` 报错 `EACCES` 或权限问题 | npm 权限不足 | 以管理员身份运行 IDEA，或修复 npm 全局目录权限 |
| 前端页面白屏（无 Console 错误） | 后端未启动或代理失败 | 确认后端 `npm run dev` 正在运行 |
| 登录提示"网络错误" | 后端未启动或端口不对 | 确认后端运行在 3000 端口，浏览器 F12 查看 Network 面板 |
| `Cannot find module` | 依赖未安装 | 在对应目录重新执行 `npm install` |
| 前端显示假数据（全是0） | 使用了 Mock 模式 | 检查 `.env.development` 中是否设置了 `VITE_USE_MOCK=true`，改为 `false` |

### 0.11 停止服务

- 在 IDEA 终端中按 `Ctrl + C` 停止当前运行的服务
- 关闭 IDEA 会自动终止所有终端进程
- 后端停止后前端仍可访问页面，但所有 API 请求会失败
- **如果重启后仍报端口占用**：打开 Windows 任务管理器（`Ctrl + Shift + Esc`），找到所有 `Node.js` 进程并结束，或在 CMD 中执行 `taskkill /IM node.exe /F`

---

## 1. 环境准备

### 1.1 启动后端服务

> 详细启动教程请参考 [第 0 节：项目启动教程](#0-项目启动教程idea--浏览器)。

```bash
cd server
npm run dev
```

服务默认运行在 `http://localhost:3000`。确保 `.env` 文件已配置好数据库密码。

### 1.2 Postman 环境变量

在 Postman 中创建以下变量：

| 变量名 | 初始值 | 说明 |
|--------|--------|------|
| `baseUrl` | `http://localhost:3000` | 服务器地址 |
| `token` | (空) | JWT Token，登录后自动设置 |

### 1.3 统一响应格式

所有接口返回格式：
```json
{
  "code": 200,
  "message": "操作成功",
  "data": {}
}
```

---

## 2. 测试流程（按顺序执行）

### Step 1: 健康检查

验证服务是否正常运行。

- **请求**: `GET {{baseUrl}}/api/health`
- **认证**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "OK",
  "data": {
    "status": "healthy",
    "timestamp": "2026-06-01T08:00:00.000Z"
  }
}
```

### Step 2: 登录获取 Token

- **请求**: `POST {{baseUrl}}/api/auth/login`
- **Body**:
```json
{
  "username": "admin",
  "password": "123456"
}
```
- **预期响应**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "username": "admin",
      "display_name": "系统管理员"
    }
  }
}
```
- **操作**: 将返回的 `token` 值复制到 Postman 环境变量 `token` 中。
- **后续请求**: 在 Authorization 标签选择 Bearer Token，填入 `{{token}}`。

### Step 3: 获取当前用户信息

- **请求**: `GET {{baseUrl}}/api/auth/profile`
- **认证**: Bearer Token
- **预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "username": "admin",
    "display_name": "系统管理员"
  }
}
```

### Step 4: 修改密码（可选）

- **请求**: `POST {{baseUrl}}/api/auth/change-password`
- **Body**:
```json
{
  "oldPassword": "123456",
  "newPassword": "newPassword123"
}
```
- **注意**: 修改后后续测试请使用新密码。

---

## 3. 员工管理

### 3.1 获取员工列表

- **请求**: `GET {{baseUrl}}/api/employees?page=1&pageSize=10`
- **可选参数**: `keyword=张`（搜索姓名/手机号）、`department=技术部`
- **预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "张三",
        "gender": "male",
        "birthday": "1990-05-15",
        "phone": "13800138000",
        "department": "技术部",
        "position": "工程师",
        "defaultTemplateName": "通用模板"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

### 3.2 新增员工

- **请求**: `POST {{baseUrl}}/api/employees`
- **Body**:
```json
{
  "name": "李四",
  "gender": "female",
  "birthday": "1992-08-20",
  "phone": "13900139000",
  "department": "人事部",
  "position": "HR专员"
}
```
- **gender 可选值**: `male`（男）、`female`（女）

### 3.3 获取员工详情

- **请求**: `GET {{baseUrl}}/api/employees/:id`（替换 `:id` 为实际 ID）

### 3.4 修改员工

- **请求**: `PUT {{baseUrl}}/api/employees/:id`
- **Body**（只传需要修改的字段）:
```json
{
  "position": "高级HR专员",
  "department": "人力资源部",
  "default_template_id": 1
}
```

### 3.5 删除员工（软删除）

- **请求**: `DELETE {{baseUrl}}/api/employees/:id`
- **说明**: 不会物理删除，仅将 `is_active` 设为 false

### 3.6 获取今天生日的员工

- **请求**: `GET {{baseUrl}}/api/employees/today-birthday`
- **说明**: 根据服务器当前日期匹配月/日

### 3.7 手动生成员工贺卡

- **请求**: `POST {{baseUrl}}/api/employees/:id/generate-card`
- **预期响应**:
```json
{
  "code": 200,
  "message": "贺卡生成成功",
  "data": {
    "cardId": "a1b2c3d4-e5f6-...",
    "cardUrl": "http://localhost:3000/card/a1b2c3d4-e5f6-..."
  }
}
```
- **说明**: 系统自动匹配模板（优先级：手动指定 > 性别+年龄 > 性别 > 通用），生成 HTML 贺卡文件。

### 3.8 Excel/CSV 批量导入

- **请求**: `POST {{baseUrl}}/api/employees/import`
- **Body** 标签选 `form-data`
- **字段**: Key 填 `file`，Type 选 `File`，Value 选择 Excel/CSV 文件
- **支持格式**: `.xlsx`、`.xls`、`.csv`
- **文件列名**: 姓名、性别、生日、手机号、部门、职位（或英文：name、gender、birthday、phone、department、position）

---

## 4. 模板管理

### 4.1 获取模板列表

- **请求**: `GET {{baseUrl}}/api/templates`
- **说明**: 列表不返回 `html_content` 字段

### 4.2 获取模板详情

- **请求**: `GET {{baseUrl}}/api/templates/:id`
- **说明**: 包含完整的 `html_content`

### 4.3 预览模板

- **请求**: `GET {{baseUrl}}/api/templates/:id/preview`
- **响应**: 直接返回渲染后的 HTML 页面（Content-Type: text/html）
- **说明**: 使用示例数据替换占位符（张三/技术部）

### 4.4 新增模板

- **请求**: `POST {{baseUrl}}/api/templates`
- **Body**:
```json
{
  "name": "青年男性模板",
  "description": "适用于20-35岁男性员工",
  "match_gender": "male",
  "match_age_min": 20,
  "match_age_max": 35,
  "html_content": "<html><body><h1>{{name}} 生日快乐！</h1><p>{{department}} 全体同仁祝你生日快乐！</p><p>{{blessing}}</p><p>{{year}}年</p></body></html>"
}
```
- **match_gender 可选值**: `all`、`male`、`female`
- **占位符**: `{{name}}`、`{{department}}`、`{{blessing}}`、`{{year}}`

### 4.5 修改模板

- **请求**: `PUT {{baseUrl}}/api/templates/:id`
- **Body**（只传需要修改的字段）

### 4.6 删除模板

- **请求**: `DELETE {{baseUrl}}/api/templates/:id`
- **注意**: 硬删除，不可恢复

---

## 5. 发送记录

### 5.1 获取发送记录列表

- **请求**: `GET {{baseUrl}}/api/records?page=1&pageSize=10`
- **可选参数**: `employeeId=1`、`status=success`、`startDate=2026-01-01`、`endDate=2026-12-31`
- **status 可选值**: `pending`、`success`、`failed`
- **预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "employee_id": 1,
        "template_id": 1,
        "card_url": "http://localhost:3000/card/a1b2c3d4-...",
        "card_id": "a1b2c3d4-...",
        "send_status": "success",
        "send_time": "2026-06-01T08:00:00.000Z",
        "admin_id": 1,
        "error_message": null,
        "employee": {
          "name": "张三",
          "department": "技术部",
          "phone": "13800138000"
        },
        "template": {
          "name": "通用模板"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

### 5.2 获取发送统计

- **请求**: `GET {{baseUrl}}/api/records/stats`
- **预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 10,
    "success": 8,
    "failed": 2,
    "success_rate": 80.00
  }
}
```

### 5.3 测试发送（模拟）

- **请求**: `POST {{baseUrl}}/api/records/test-send/:employeeId`
- **说明**: 开发调试用，仅模拟发送结果，不会实际发送彩信

---

## 6. 贺卡公开访问

### 访问贺卡页面

- **请求**: `GET {{baseUrl}}/card/:cardId`
- **认证**: 无需认证
- **响应**: 直接返回 HTML 贺卡页面
- **说明**: `cardId` 为 UUID v4 格式，通过生成贺卡接口获得

---

## 7. 常见问题排查

### 7.1 连接失败
- **现象**: `Could not get any response`
- **排查**: 确认后端服务已启动（`npm run dev`），端口 3000 未被占用

### 7.2 401 Unauthorized
- **现象**: 返回 `"message": "未提供认证Token"` 或 `"Token无效或已过期"`
- **排查**:
  1. 确认已登录并获取了 token
  2. 确认 Authorization 头格式为 `Bearer <token>`
  3. Token 有效期 24 小时，过期需重新登录

### 7.3 404 Not Found
- **排查**: 检查 URL 中的 ID 是否正确，确认资源是否存在

### 7.4 500 Internal Server Error
- **排查**:
  1. 查看后端控制台日志
  2. 确认 MySQL 数据库已启动且可连接
  3. 确认 .env 中数据库配置正确

### 7.5 Excel 导入失败
- **排查**:
  1. 确认文件格式为 `.xlsx`、`.xls` 或 `.csv`
  2. 确认列名正确（姓名/性别/生日/手机号/部门/职位）
  3. Body 类型选择 `form-data`，字段名为 `file`
  4. 不要手动设置 `Content-Type` 头（Postman 会自动处理 multipart boundary）

### 7.6 贺卡生成失败
- **排查**:
  1. 确认至少有一个启用状态的模板
  2. 确认 `generated-cards/` 目录有写入权限
  3. 查看后端日志中的具体错误信息

---

## 8. 前后端集成测试

### 8.1 前端代理配置

前端开发服务器（`admin-web`）通过 Vite 代理转发 API 请求：
- 前端地址: `http://localhost:5173`
- 代理规则: `/api/*` -> `http://localhost:3000/api/*`

### 8.2 集成测试步骤

> 前后端启动方式详见 [第 0 节：项目启动教程](#0-项目启动教程idea--浏览器)。

1. 确保后端（端口 3000）和前端（端口 5173）同时运行
2. 浏览器访问 `http://localhost:5173`
3. 使用默认账号 `admin / 123456` 登录
4. 逐项验证以下功能：
   - 仪表盘统计数据显示
   - 员工列表加载、搜索、分页
   - 新增/编辑/删除员工
   - Excel/CSV 批量导入
   - 模板管理（CRUD + 预览）
   - 手动生成贺卡
   - 发送记录查看

### 8.3 前端开发模式

如需使用模拟数据（无需后端），在前端目录创建 `.env.development`：
```env
VITE_USE_MOCK=true
```
默认情况下 `VITE_USE_MOCK` 未设置，前端会请求真实后端 API。

---

## 9. 更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.1.0 | 2026-06-01 | 新增 IDEA 项目启动详细教程和使用指南 |
| v2.0.0 | 2026-06-01 | 全面重写：统一响应格式、修复健康检查、添加 Template include、修正字段名、添加 CSV 支持 |
| v1.1.0 | 2026-06-01 | 添加前后端对接说明和测试清单 |
| v1.0.0 | 2026-05-30 | 初始版本 |
