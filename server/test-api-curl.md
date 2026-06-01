# API 测试 Curl 命令

> 基础地址: `http://localhost:3000`

---

## 1. 健康检查（无需认证）

```bash
curl http://localhost:3000/api/health
```

---

## 2. 认证模块

### 登录获取 Token
```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\": \"admin\", \"password\": \"123456\"}"

```

### 获取当前用户信息
```bash
curl http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiJhZG1pbiIsImRpc3BsYXlfbmFtZSI6Iuezu-e7n-
euoeeQhuWRmCIsImlhdCI6MTc4MDE0ODMxMywiZXhwIjoxNzgwMjM0NzEzfQ.ChjsnFRPRsyPZq2CIDaj5E8anNWs7belhOd9-TxGBas0>"
```

### 修改密码
```bash
curl -X POST http://localhost:3000/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的token>" \
  -d '{"oldPassword": "admin123", "newPassword": "newpass123"}'
```

---

## 3. 员工管理模块

### 获取员工列表（分页）
```bash
curl "http://localhost:3000/api/employees?page=1&pageSize=10" \
  -H "Authorization: Bearer <你的token>"
```

### 搜索员工
```bash
curl "http://localhost:3000/api/employees?keyword=张" \
  -H "Authorization: Bearer <你的token>"
```

### 按部门筛选
```bash
curl "http://localhost:3000/api/employees?department=技术部" \
  -H "Authorization: Bearer <你的token>"
```

### 获取今天生日的员工
```bash
curl http://localhost:3000/api/employees/today-birthday \
  -H "Authorization: Bearer <你的token>"
```

### 新增员工
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的token>" \
  -d '{
    "name": "张三",
    "gender": "male",
    "birthday": "1990-05-15",
    "phone": "13800138000",
    "department": "技术部",
    "position": "工程师"
  }'
```

### 获取员工详情
```bash
curl http://localhost:3000/api/employees/<员工ID> \
  -H "Authorization: Bearer <你的token>"
```

### 修改员工
```bash
curl -X PUT http://localhost:3000/api/employees/<员工ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的token>" \
  -d '{
    "position": "高级工程师",
    "department": "研发部"
  }'
```

### 删除员工（软删除）
```bash
curl -X DELETE http://localhost:3000/api/employees/<员工ID> \
  -H "Authorization: Bearer <你的token>"
```

### 手动生成员工贺卡
```bash
curl -X POST http://localhost:3000/api/employees/<员工ID>/generate-card \
  -H "Authorization: Bearer <你的token>"
```

### Excel 批量导入员工
```bash
curl -X POST http://localhost:3000/api/employees/import \
  -H "Authorization: Bearer <你的token>" \
  -F "file=@/path/to/employees.xlsx"
```

---

## 4. 模板管理模块

### 获取模板列表
```bash
curl http://localhost:3000/api/templates \
  -H "Authorization: Bearer <你的token>"
```

### 获取模板详情
```bash
curl http://localhost:3000/api/templates/<模板ID> \
  -H "Authorization: Bearer <你的token>"
```

### 新增模板
```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的token>" \
  -d '{
    "name": "通用模板",
    "description": "适用于所有员工",
    "match_gender": "all",
    "match_age_min": 18,
    "match_age_max": 60,
    "html_content": "<html><body><h1>生日快乐 {{name}}!</h1><p>{{blessing}}</p></body></html>"
  }'
```

### 修改模板
```bash
curl -X PUT http://localhost:3000/api/templates/<模板ID> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你的token>" \
  -d '{
    "name": "更新后的模板名",
    "is_active": true
  }'
```

### 删除模板
```bash
curl -X DELETE http://localhost:3000/api/templates/<模板ID> \
  -H "Authorization: Bearer <你的token>"
```

### 预览模板效果
```bash
curl http://localhost:3000/api/templates/<模板ID>/preview \
  -H "Authorization: Bearer <你的token>"
```

---

## 5. 发送记录模块

### 获取发送记录列表
```bash
curl "http://localhost:3000/api/records?page=1&pageSize=10" \
  -H "Authorization: Bearer <你的token>"
```

### 按状态筛选记录
```bash
curl "http://localhost:3000/api/records?status=success" \
  -H "Authorization: Bearer <你的token>"
```

### 按日期范围筛选
```bash
curl "http://localhost:3000/api/records?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <你的token>"
```

### 获取发送统计
```bash
curl http://localhost:3000/api/records/stats \
  -H "Authorization: Bearer <你的token>"
```

### 测试发送
```bash
curl -X POST http://localhost:3000/api/records/test-send/<员工ID> \
  -H "Authorization: Bearer <你的token>"
```

---

## 6. 贺卡访问（公开，无需认证）

```bash
curl http://localhost:3000/card/<贺卡ID>
```

---

## Windows PowerShell 版本

如果在 Windows PowerShell 中使用，需要将 curl 命令改为：

```powershell
# 示例：登录
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username": "admin", "password": "admin123"}'

# 示例：带认证的请求（需要先设置变量）
$token = "你的token"
Invoke-RestMethod -Uri "http://localhost:3000/api/employees" `
  -Headers @{ "Authorization" = "Bearer $token" }
```