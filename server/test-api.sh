#!/bin/bash

# ===========================================
# 生日彩信系统 API 测试脚本
# ===========================================

BASE_URL="http://localhost:3000"

echo "==========================================="
echo "生日彩信系统 API 测试"
echo "==========================================="

# ===========================================
# 1. 健康检查（无需认证）
# ===========================================
echo ""
echo "[1] 健康检查"
curl -s "$BASE_URL/api/health" | jq .

# ===========================================
# 2. 认证相关
# ===========================================
echo ""
echo "[2] 管理员登录"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }')
echo "$LOGIN_RESPONSE" | jq .

# 提取 token（如果登录成功）
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token // empty')

if [ -z "$TOKEN" ]; then
  echo "登录失败，后续需要认证的接口将跳过"
fi

# 设置认证头
AUTH_HEADER="Authorization: Bearer $TOKEN"

# 获取当前用户信息
echo ""
echo "[3] 获取当前用户信息"
curl -s "$BASE_URL/api/auth/profile" \
  -H "$AUTH_HEADER" | jq .

# ===========================================
# 3. 员工管理
# ===========================================
echo ""
echo "[4] 获取员工列表（分页）"
curl -s "$BASE_URL/api/employees?page=1&pageSize=10" \
  -H "$AUTH_HEADER" | jq .

echo ""
echo "[5] 搜索员工（关键词）"
curl -s "$BASE_URL/api/employees?keyword=张" \
  -H "$AUTH_HEADER" | jq .

echo ""
echo "[6] 按部门筛选员工"
curl -s "$BASE_URL/api/employees?department=技术部" \
  -H "$AUTH_HEADER" | jq .

echo ""
echo "[7] 获取今天生日的员工"
curl -s "$BASE_URL/api/employees/today-birthday" \
  -H "$AUTH_HEADER" | jq .

# 新增员工
echo ""
echo "[8] 新增员工"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/employees" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "name": "测试员工",
    "gender": "male",
    "birthday": "1990-05-15",
    "phone": "13800138000",
    "department": "技术部",
    "position": "工程师"
  }')
echo "$CREATE_RESPONSE" | jq .

# 提取员工ID
EMPLOYEE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id // empty')

if [ -n "$EMPLOYEE_ID" ]; then
  echo ""
  echo "[9] 获取员工详情 (ID: $EMPLOYEE_ID)"
  curl -s "$BASE_URL/api/employees/$EMPLOYEE_ID" \
    -H "$AUTH_HEADER" | jq .

  echo ""
  echo "[10] 修改员工信息"
  curl -s -X PUT "$BASE_URL/api/employees/$EMPLOYEE_ID" \
    -H "Content-Type: application/json" \
    -H "$AUTH_HEADER" \
    -d '{
      "position": "高级工程师",
      "department": "研发部"
    }' | jq .

  echo ""
  echo "[11] 为员工生成贺卡"
  curl -s -X POST "$BASE_URL/api/employees/$EMPLOYEE_ID/generate-card" \
    -H "$AUTH_HEADER" | jq .
fi

# ===========================================
# 4. 模板管理
# ===========================================
echo ""
echo "[12] 获取模板列表"
curl -s "$BASE_URL/api/templates" \
  -H "$AUTH_HEADER" | jq .

# 获取第一个模板ID
FIRST_TEMPLATE_ID=$(curl -s "$BASE_URL/api/templates" \
  -H "$AUTH_HEADER" | jq -r '.data[0].id // empty')

if [ -n "$FIRST_TEMPLATE_ID" ]; then
  echo ""
  echo "[13] 获取模板详情 (ID: $FIRST_TEMPLATE_ID)"
  curl -s "$BASE_URL/api/templates/$FIRST_TEMPLATE_ID" \
    -H "$AUTH_HEADER" | jq .

  echo ""
  echo "[14] 预览模板效果"
  curl -s "$BASE_URL/api/templates/$FIRST_TEMPLATE_ID/preview" \
    -H "$AUTH_HEADER"
fi

# 新增模板
echo ""
echo "[15] 新增模板"
curl -s -X POST "$BASE_URL/api/templates" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "name": "测试模板",
    "description": "用于测试的模板",
    "match_gender": "all",
    "match_age_min": 18,
    "match_age_max": 60,
    "html_content": "<html><body><h1>生日快乐 {{name}}!</h1><p>来自{{department}}的祝福</p><p>{{blessing}}</p><p>年份: {{year}}</p></body></html>"
  }' | jq .

# ===========================================
# 5. 发送记录
# ===========================================
echo ""
echo "[16] 获取发送记录列表"
curl -s "$BASE_URL/api/records?page=1&pageSize=10" \
  -H "$AUTH_HEADER" | jq .

echo ""
echo "[17] 获取发送统计"
curl -s "$BASE_URL/api/records/stats" \
  -H "$AUTH_HEADER" | jq .

if [ -n "$EMPLOYEE_ID" ]; then
  echo ""
  echo "[18] 测试发送 (Employee ID: $EMPLOYEE_ID)"
  curl -s -X POST "$BASE_URL/api/records/test-send/$EMPLOYEE_ID" \
    -H "$AUTH_HEADER" | jq .
fi

# ===========================================
# 6. 清理（删除测试数据）
# ===========================================
if [ -n "$EMPLOYEE_ID" ]; then
  echo ""
  echo "[19] 删除测试员工 (软删除)"
  curl -s -X DELETE "$BASE_URL/api/employees/$EMPLOYEE_ID" \
    -H "$AUTH_HEADER" | jq .
fi

echo ""
echo "==========================================="
echo "测试完成"
echo "==========================================="
