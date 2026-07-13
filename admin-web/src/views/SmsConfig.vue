<template>
  <div class="sms-config-page">
    <div class="page-header">
      <h2>短信接口配置</h2>
      <p class="page-desc">管理中国移动 CSP 5G 视频短信接口配置，修改后即时生效，无需重启服务。</p>
    </div>

    <el-skeleton :loading="loading" :rows="10" animated>
      <template #default>
        <!-- CSP 5G 视频短信配置 -->
        <el-card class="config-section" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon><Connection /></el-icon>
              <span>CSP 5G 视频短信配置</span>
              <el-tag type="info" size="small" style="margin-left: 12px">V2.4.3</el-tag>
            </div>
          </template>

          <el-form label-position="top" :model="cspForm">
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12" v-for="item in cspItems" :key="item.key">
                <el-form-item>
                  <template #label>
                    <div class="field-label">
                      <span class="field-name">{{ item.label }}</span>
                      <el-tag
                        :type="item.configured ? 'success' : 'danger'"
                        size="small"
                        effect="plain"
                      >
                        {{ item.configured ? '已配置' : '未配置' }}
                      </el-tag>
                    </div>
                    <div class="field-desc">{{ item.description }}</div>
                  </template>
                  <el-input
                    v-model="cspForm[item.key]"
                    :type="item.isSecret ? 'password' : 'text'"
                    :show-password="item.isSecret"
                    :placeholder="getPlaceholder(item.key)"
                    clearable
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-card>

        <!-- 基础 SMS 配置 -->
        <el-card class="config-section" shadow="hover">
          <template #header>
            <div class="section-header">
              <el-icon><Setting /></el-icon>
              <span>基础短信配置</span>
            </div>
          </template>

          <el-form label-position="top" :model="smsForm">
            <el-row :gutter="24">
              <el-col :xs="24" :sm="12" v-for="item in smsItems" :key="item.key">
                <el-form-item>
                  <template #label>
                    <div class="field-label">
                      <span class="field-name">{{ item.label }}</span>
                      <el-tag
                        :type="item.configured ? 'success' : 'info'"
                        size="small"
                        effect="plain"
                      >
                        {{ item.configured ? '已配置' : '默认' }}
                      </el-tag>
                    </div>
                    <div class="field-desc">{{ item.description }}</div>
                  </template>

                  <!-- SMS_PROVIDER 用下拉框 -->
                  <el-select
                    v-if="item.key === 'SMS_PROVIDER'"
                    v-model="smsForm[item.key]"
                    style="width: 100%"
                  >
                    <el-option label="mock - 模拟发送（开发环境）" value="mock" />
                    <el-option label="carrier - 运营商接口（生产环境）" value="carrier" />
                  </el-select>

                  <!-- 其他用输入框 -->
                  <el-input
                    v-else
                    v-model="smsForm[item.key]"
                    :placeholder="item.key === 'SMS_MAX_RETRIES' ? '3' : item.key === 'SMS_RETRY_DELAY' ? '1000' : '10000'"
                    clearable
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </el-card>

        <!-- 操作按钮 -->
        <div class="action-bar">
          <el-button @click="loadConfig" :loading="loading">
            <el-icon><Refresh /></el-icon>
            重新加载
          </el-button>
          <el-button type="primary" @click="handleSave" :loading="saving" size="large">
            <el-icon><Check /></el-icon>
            保存配置
          </el-button>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Connection, Setting, Refresh, Check } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getSmsConfig, updateSmsConfig, type ConfigItem } from '@/api/smsConfig'

const loading = ref(false)
const saving = ref(false)

const cspItems = ref<ConfigItem[]>([])
const smsItems = ref<ConfigItem[]>([])
const cspForm = reactive<Record<string, string>>({})
const smsForm = reactive<Record<string, string>>({})

const loadConfig = async () => {
  loading.value = true
  try {
    const data = await getSmsConfig()
    cspItems.value = data.csp
    smsItems.value = data.sms

    // 填充表单
    for (const item of data.csp) {
      cspForm[item.key] = item.value
    }
    for (const item of data.sms) {
      smsForm[item.key] = item.value
    }
  } catch (err: any) {
    ElMessage.error('加载配置失败: ' + (err?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    // 合并所有配置项
    const updates: Record<string, string> = {}

    for (const item of cspItems.value) {
      const newVal = cspForm[item.key] || ''
      if (newVal !== item.value) {
        updates[item.key] = newVal
      }
    }
    for (const item of smsItems.value) {
      const newVal = smsForm[item.key] || ''
      if (newVal !== item.value) {
        updates[item.key] = newVal
      }
    }

    if (Object.keys(updates).length === 0) {
      ElMessage.info('没有修改任何配置项')
      saving.value = false
      return
    }

    await updateSmsConfig(updates)
    ElMessage.success(`已保存 ${Object.keys(updates).length} 项配置，下次发送时生效`)

    // 重新加载以刷新状态标签
    await loadConfig()
  } catch (err: any) {
    ElMessage.error('保存失败: ' + (err?.message || '未知错误'))
  } finally {
    saving.value = false
  }
}

const getPlaceholder = (key: string): string => {
  const placeholders: Record<string, string> = {
    CSP_APP_ID: 'CSP 平台获取的 ChatbotID',
    CSP_PASSWORD: 'CSP 平台获取的应用密码',
    CSP_SERVER_ROOT: 'https://api.5gcsp.mas.10086.cn/ocsp/developer',
    CSP_FILE_SERVER_ROOT: 'https://api.5gcsp.mas.10086.cn/ocsp/fileservice',
    CSP_CHATBOT_URI: 'sip:ChatbotID@botplatform.rcs.chinamobile.com',
    CSP_CALLBACK_URL: 'https://your-domain.com/api/sms-callback',
    CSP_VIDEO_TEMPLATE_ID: '审核通过的 5G 视信模板 ID',
    CSP_TEMP_STORE_TIME: '259200'
  }
  return placeholders[key] || ''
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.sms-config-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.config-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}

.field-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-name {
  font-weight: 500;
  color: var(--text-primary);
}

.field-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 1.4;
}

.action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

/* 表单间距调整 */
:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-form-item__label) {
  padding-bottom: 4px !important;
  line-height: 1.4 !important;
}
</style>
