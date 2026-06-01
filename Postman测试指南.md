# 生日彩信系统 Postman 测试指南

## 1. API基础配置

- **服务器地址**: `http://localhost:3000`
- **端口**: 3000
- **认证方式**: JWT (JSON Web Token)
- **认证头格式**: `Authorization: Bearer <token>`

## 2. 认证流程

### 获取JWT token步骤:
1. 发送POST请求到 `/api/auth/login`
2. 请求体包含用户名和密码
3. 成功后从响应中提取token
4. 将token设置到后续请求的Authorization头中

### 登录请求示例:
- **URL**: `http://localhost:3000/api/auth/login`
- **Method**: POST
- **Headers**:
  - `Content-Type: application/json`
- **Body (raw JSON)**:
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
    "token": "<JWT_TOKEN>",
    "user": {
      "id": 1,
      "username": "admin",
      "display_name": "管理员"
    }
  }
}
```

### 设置Authorization头:
在Postman中，选择"Authorization"标签 -> Type选择"Bearer Token" -> 在Token字段粘贴获取到的JWT token。

## 3. API端点详细测试方法

### 3.1 健康检查 (无需认证)
- **URL**: `http://localhost:3000/api/health`
- **Method**: GET
- **Headers**: 无
- **Body**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "OK",
  "data": {
    "status": "healthy",
    "timestamp": "2026-05-31T08:00:00.000Z"
  }
}
```

### 3.2 获取当前用户信息
- **URL**: `http://localhost:3000/api/auth/profile`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "username": "admin",
    "display_name": "管理员"
  }
}
```

### 3.3 修改密码
- **URL**: `http://localhost:3000/api/auth/change-password`
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body (raw JSON)**:
```json
{
  "oldPassword": "123456",
  "newPassword": "123456789"
}
```
- **预期响应**:
```json
{
  "code": 200,
  "message": "密码修改成功",
  "data": null
}
```

### 3.4 员工管理

#### 获取员工列表
- **URL**: `http://localhost:3000/api/employees?page=1&pageSize=10`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
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

#### 搜索员工
- **URL**: `http://localhost:3000/api/employees?keyword=张`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**: 同上，返回匹配关键词的员工列表

#### 按部门筛选员工
- **URL**: `http://localhost:3000/api/employees?department=技术部`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**: 同上，返回指定部门的员工列表

#### 获取今天生日的员工
- **URL**: `http://localhost:3000/api/employees/today-birthday`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
[
  {
    "id": 1,
    "name": "张三",
    "gender": "male",
    "birthday": "1990-05-15",
    "phone": "13800138000",
    "department": "技术部",
    "position": "工程师",
    "default_template": {
      "id": 1,
      "name": "通用模板"
    }
  }
]
```

#### 新增员工
- **URL**: `http://localhost:3000/api/employees`
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body (raw JSON)**:
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
- **预期响应**:
```json
{
  "code": 200,
  "message": "添加成功",
  "data": {
    "id": 2,
    "name": "李四",
    "gender": "female",
    "birthday": "1992-08-20",
    "phone": "13900139000",
    "department": "人事部",
    "position": "HR专员",
    "default_template_id": null,
    "is_active": true,
    "created_at": "2026-05-31T08:00:00.000Z",
    "updated_at": "2026-05-31T08:00:00.000Z"
  }
}
```

#### 获取员工详情
- **URL**: `http://localhost:3000/api/employees/2` (替换2为实际员工ID)
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**: 返回指定ID的员工详细信息

#### 修改员工信息
- **URL**: `http://localhost:3000/api/employees/2` (替换2为实际员工ID)
- **Method**: PUT
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body (raw JSON)**:
```json
{
  "position": "高级HR专员",
  "department": "人力资源部"
}
```
- **预期响应**:
```json
{
  "code": 200,
  "message": "修改成功",
  "data": null
}
```

#### 删除员工（软删除即在数据库中保留记录但标记为已删除）
- **URL**: `http://localhost:3000/api/employees/2` (替换2为实际员工ID)
- **Method**: DELETE
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

#### 手动生成员工贺卡
- **URL**: `http://localhost:3000/api/employees/2/generate-card` (替换2为实际员工ID)
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "贺卡生成成功",
  "data": {
    "cardId": "card_123456",
    "cardUrl": "http://localhost:3000/card/card_123456"
  }
}
```

### 3.5 模板管理

#### 获取模板列表
- **URL**: `http://localhost:3000/api/templates`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
[
  {
    "id": 1,
    "name": "通用模板",
    "description": "适用于所有员工的通用生日贺卡模板",
    "match_gender": "all",
    "match_age_min": 18,
    "match_age_max": 60,
    "is_active": true,
    "created_at": "2026-05-30T16:00:00.000Z"
  }
]
```

#### 获取模板详情
- **URL**: `http://localhost:3000/api/templates/1` (替换1为实际模板ID)
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**: 返回指定ID的模板详细信息，包含html_content字段

#### 预览模板效果
- **URL**: `http://localhost:3000/api/templates/1/preview` (替换1为实际模板ID)
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**: HTML页面内容，显示预览效果

#### 新增模板
- **URL**: `http://localhost:3000/api/templates`
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body (raw JSON)**:
```json
{
  "name": "测试模板",
  "description": "用于测试的模板",
  "match_gender": "all",
  "match_age_min": 18,
  "match_age_max": 60,
  "html_content": "<html><body><h1>生日快乐 {{name}}!</h1><p>来自{{department}}的祝福</p><p>{{blessing}}</p><p>年份: {{year}}</p></body></html>"
}
```
- **预期响应**:
```json
{
  "code": 200,
  "message": "添加成功",
  "data": {
    "id": 2,
    "name": "测试模板",
    "description": "用于测试的模板",
    "match_gender": "all",
    "match_age_min": 18,
    "match_age_max": 60,
    "html_content": "<html><body><h1>生日快乐 {{name}}!</h1><p>来自{{department}}的祝福</p><p>{{blessing}}</p><p>年份: {{year}}</p></body></html>",
    "preview_image": null,
    "is_active": true,
    "created_at": "2026-05-31T08:00:00.000Z",
    "updated_at": "2026-05-31T08:00:00.000Z"
  }
}
```

#### 修改模板
- **URL**: `http://localhost:3000/api/templates/2` (替换2为实际模板ID)
- **Method**: PUT
- **Headers**: 
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- **Body (raw JSON)**:
```json
{
  "description": "更新后的测试模板描述"
}
```
- **预期响应**:
```json
{
  "code": 200,
  "message": "修改成功",
  "data": null
}
```

#### 删除模板
- **URL**: `http://localhost:3000/api/templates/2` (替换2为实际模板ID)
- **Method**: DELETE
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

### 3.6 发送记录管理

#### 获取发送记录列表
- **URL**: `http://localhost:3000/api/records?page=1&pageSize=10`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
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
        "card_url": "http://localhost:3000/card/card_123456",
        "card_id": "card_123456",
        "send_status": "success",
        "send_time": "2026-05-31T08:00:00.000Z",
        "admin_id": 1,
        "error_message": null,
        "created_at": "2026-05-31T08:00:00.000Z",
        "employee": {
          "name": "张三",
          "department": "技术部"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
}
```

#### 获取发送统计
- **URL**: `http://localhost:3000/api/records/stats`
- **Method**: GET
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 1,
    "success": 1,
    "failed": 0,
    "successRate": "100.00"
  }
}
```

#### 测试发送
- **URL**: `http://localhost:3000/api/records/test-send/1` (替换1为实际员工ID)  `http://localhost:3000/api/employees/1/generate-card`（替换1为实际员工ID）
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer <token>`
- **Body**: 无
- **预期响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "employeeId": 1,
    "message": "测试发送成功（模拟）",
    "status": "success"
  }
}
```

## 4. 测试顺序建议

按照以下顺序执行测试，确保依赖关系正确：

1. 健康检查 (`/api/health`) - 验证服务是否正常运行
2. 管理员登录 (`/api/auth/login`) - 获取JWT token
3. 获取当前用户信息 (`/api/auth/profile`) - 验证token有效性
4. 员工管理相关接口:
   - 获取员工列表
   - 新增员工
   - 获取员工详情
   - 修改员工信息
   - 获取今天生日的员工
   - 手动生成员工贺卡
   - 删除员工（测试完成后）
5. 模板管理相关接口:
   - 获取模板列表
   - 获取模板详情
   - 预览模板效果
   - 新增模板
   - 修改模板
   - 删除模板（测试完成后）
6. 发送记录相关接口:
   - 获取发送记录列表
   - 获取发送统计
   - 测试发送

## 5. 测试数据

### 员工测试数据
```json
{
  "name": "测试员工",
  "gender": "male",
  "birthday": "1990-05-15",
  "phone": "13800138000",
  "department": "技术部",
  "position": "工程师"
}
```

### 模板测试数据
```json
{
  "name": "测试模板",
  "description": "用于测试的模板",
  "match_gender": "all",
  "match_age_min": 18,
  "match_age_max": 60,
  "html_content": "<html><body><h1>生日快乐 {{name}}!</h1><p>来自{{department}}的祝福</p><p>{{blessing}}</p><p>年份: {{year}}</p></body></html>"
}
```

## 6. 预期结果

- 所有成功请求应返回HTTP状态码200
- 响应体中的code字段应为200
- 数据操作类请求（新增、修改、删除）成功后应返回相应的成功消息
- 查询类请求应返回请求的数据列表或详情
- 错误情况应返回相应的错误码和错误信息

## 7. 错误处理

### 常见错误情况:

1. **401 Unauthorized** - 未提供有效的JWT token
   - 解决方案: 确保已登录并获取token，将token正确设置到Authorization头中

2. **404 Not Found** - 请求的资源不存在
   - 解决方案: 检查URL中的ID是否正确，确认资源是否存在

3. **400 Bad Request** - 请求参数错误或缺失
   - 解决方案: 检查请求体JSON格式是否正确，必填字段是否提供

4. **500 Internal Server Error** - 服务器内部错误
   - 解决方案: 检查服务器控制台日志，确认数据库连接是否正常

### 特定错误示例:

#### 登录失败
- **响应**:
```json
{
  "code": 401,
  "message": "用户名或密码错误",
  "data": null
}
```
- **解决方案**: 检查用户名和密码是否正确，默认管理员账号为admin/admin123

#### 原密码错误（修改密码时）
- **响应**:
```json
{
  "code": 400,
  "message": "原密码错误",
  "data": null
}
```
- **解决方案**: 确认输入的原密码是否正确

#### 员工不存在
- **响应**:
```json
{
  "code": 404,
  "message": "员工不存在",
  "data": null
}
```
- **解决方案**: 检查员工ID是否正确，或先通过员工列表接口确认员工是否存在

#### 没有可用的模板
- **响应**:
```json
{
  "code": 400,
  "message": "没有可用的模板",
  "data": null
}
```
- **解决方案**: 确保至少有一个激活状态的模板存在

通过以上指南，您可以系统地测试生日彩信系统的各个功能模块。建议在Postman中创建一个Collection来组织这些请求，并使用环境变量来管理baseUrl和token，以便于测试。