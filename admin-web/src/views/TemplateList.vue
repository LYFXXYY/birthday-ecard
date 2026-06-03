<template>
  <div class="template-list-container">
    <el-card>
      <!-- 页面头部 -->
      <template #header>
        <div class="card-header">
          <span class="title">贺卡模板管理</span>
          <!-- 添加模板功能已移除 -->
        </div>
      </template>

      <!-- 模板卡片网格 -->
      <div v-loading="loading" class="template-grid">
        <el-empty v-if="templates.length === 0 && !loading" description="暂无模板" />
        
        <div v-else class="cards-container">
          <el-card
            v-for="template in templates"
            :key="template.id"
            class="template-card"
            shadow="hover"
          >
            <!-- 模板预览图 -->
            <div class="template-preview">
              <div class="preview-placeholder">
                <el-icon :size="48"><Picture /></el-icon>
                <div class="preview-text">模板预览</div>
              </div>
            </div>

            <!-- 模板信息 -->
            <div class="template-info">
              <h3 class="template-name">{{ template.name }}</h3>
              <p class="template-desc">{{ template.description || '暂无描述' }}</p>
              
              <div class="template-meta">
                <el-tag size="small" type="info">
                  {{ getGenderText(template.match_gender) }}
                </el-tag>
                <el-tag v-if="template.match_age_min || template.match_age_max" size="small">
                  {{ template.match_age_min || '-' }}-{{ template.match_age_max || '-' }}岁
                </el-tag>
              </div>
            </div>

            <!-- 操作按钮：预览与编辑（新增/删除已移除） -->
            <div class="template-actions">
              <el-button type="info" @click="handleOpenPreviewWindow(template)">
                <el-icon><Expand /></el-icon>
                新窗口预览
              </el-button>
              <el-button type="warning" @click="handleEdit(template)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
            </div>
          </el-card>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Picture, Edit, Expand } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getTemplateList, previewTemplate } from '@/api/templates'
import type { Template } from '@/api/templates'

const router = useRouter()

// 模板列表
const templates = ref<Template[]>([])
const loading = ref(false)

// 获取性别文字
const getGenderText = (gender?: string) => {
  const genderMap: Record<string, string> = {
    male: '男性',
    female: '女性',
    all: '不限'
  }
  return genderMap[gender || 'all'] || '不限'
}

// 加载模板列表
const loadTemplates = async () => {
  loading.value = true
  try {
    templates.value = await getTemplateList()
  } catch (error) {
    console.error('加载模板列表失败：', error)
    // 接口异常时使用默认兜底数据
    templates.value = []
  } finally {
    loading.value = false
  }
}

// 编辑模板
const handleEdit = (template: Template) => {
  router.push(`/templates/${template.id}/edit`)
}

// 预览模板
const openPreviewWindow = (html: string, title = '模板预览') => {
  const previewWindow = window.open('', '_blank')
  if (!previewWindow) {
    ElMessage.error('弹窗被拦截，请允许弹窗')
    return
  }

  previewWindow.document.open()
  previewWindow.document.write(html)
  previewWindow.document.close()
  previewWindow.document.title = title
}

const handleOpenPreviewWindow = async (template: Template) => {
  if (!template.id) {
    const html = template.html_content || '<p>暂无内容</p>'
    openPreviewWindow(html, template.name || '模板预览')
    return
  }

  try {
    const html = await previewTemplate(template.id)
    openPreviewWindow(html, template.name || '模板预览')
  } catch (error) {
    console.error('新窗口预览失败，使用本地回退：', error)
    const html = template.html_content || '<p>暂无内容</p>'
    openPreviewWindow(html, template.name || '模板预览')
  }
}

// 删除功能已移除，列表仅支持编辑与预览

// 页面加载时获取数据
onMounted(() => {
  loadTemplates()
})
</script>

<style scoped>
.template-list-container {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.template-grid {
  min-height: 400px;
}

.cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.template-card {
  transition: all 0.3s;
}

.template-card:hover {
  transform: translateY(-4px);
}

.template-preview {
  position: relative;
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-placeholder {
  text-align: center;
  color: white;
}

.preview-text {
  margin-top: 8px;
  font-size: 14px;
  opacity: 0.9;
}

.template-info {
  margin-bottom: 16px;
}

.template-name {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.template-desc {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.template-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.template-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.template-actions .el-button {
  flex: 1;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .cards-container {
    grid-template-columns: 1fr;
  }

  .template-actions {
    flex-direction: column;
  }

  .template-actions .el-button {
    width: 100%;
  }
}
</style>