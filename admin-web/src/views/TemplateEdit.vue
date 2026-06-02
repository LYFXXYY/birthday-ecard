<template>
  <div class="template-edit-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">{{ isEdit ? '编辑模板' : '添加模板' }}</span>
          <div class="header-actions">
            <el-button @click="handleBack">
              <el-icon><Back /></el-icon>
              返回
            </el-button>
            <el-button type="primary" @click="togglePreview" v-if="isEdit">
              <el-icon><View /></el-icon>
              {{ showPreview ? '隐藏预览' : '显示预览' }}
            </el-button>
          </div>
        </div>
      </template>

      <div class="edit-content" :class="{ 'with-preview': showPreview && isEdit }">
        <!-- 左侧编辑区 -->
        <div class="edit-form">
          <el-form
            ref="formRef"
            :model="formData"
            :rules="rules"
            label-width="120px"
            v-loading="loading"
          >
            <el-form-item label="模板名称" prop="name">
              <el-input v-model="formData.name" placeholder="请输入模板名称" />
            </el-form-item>

            <el-form-item label="模板描述" prop="description">
              <el-input
                v-model="formData.description"
                type="textarea"
                :rows="2"
                placeholder="请输入模板描述"
              />
            </el-form-item>

            <el-divider content-position="left">匹配规则</el-divider>

            <el-form-item label="匹配性别" prop="match_gender">
              <el-radio-group v-model="formData.match_gender">
                <el-radio value="all">不限</el-radio>
                <el-radio value="male">男性</el-radio>
                <el-radio value="female">女性</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="年龄范围">
              <el-space>
                <el-input-number
                  v-model="formData.match_age_min"
                  :min="0"
                  :max="100"
                  placeholder="最小年龄"
                  controls-position="right"
                  style="width: 120px"
                />
                <span>至</span>
                <el-input-number
                  v-model="formData.match_age_max"
                  :min="0"
                  :max="100"
                  placeholder="最大年龄"
                  controls-position="right"
                  style="width: 120px"
                />
                <span>岁</span>
              </el-space>
            </el-form-item>

            <el-form-item label="兴趣标签">
              <el-input
                v-model="formData.match_interests"
                placeholder="多个标签用逗号分隔（可选）"
              />
            </el-form-item>

            <el-divider content-position="left">模板内容</el-divider>

            <el-form-item label="HTML内容" prop="html_content">
              <el-input
                v-model="formData.html_content"
                type="textarea"
                :rows="20"
                placeholder="请输入贺卡HTML模板内容，使用 {{name}}、{{department}} 等占位符"
                class="html-editor"
              />
              <div class="editor-tips">
                <p>💡 可用占位符：</p>
                <el-tag size="small" style="margin: 4px" v-text="'{{name}}'"></el-tag>
                <el-tag size="small" style="margin: 4px" v-text="'{{department}}'"></el-tag>
                <el-tag size="small" style="margin: 4px" v-text="'{{position}}'"></el-tag>
                <el-tag size="small" style="margin: 4px" v-text="'{{blessing}}'"></el-tag>
              </div>
            </el-form-item>

            <el-form-item label="状态" prop="is_active">
              <el-switch
                v-model="formData.is_active"
                :active-value="1"
                :inactive-value="0"
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSubmit" :loading="submitting">
                {{ isEdit ? '保存修改' : '提交' }}
              </el-button>
              <el-button @click="handleBack">取消</el-button>
            </el-form-item>
          </el-form>
        </div>

        <!-- 右侧预览区 -->
        <div class="preview-panel" v-if="showPreview && isEdit">
          <el-card shadow="never">
            <template #header>
              <div class="preview-header">
                <span>实时预览</span>
                <el-button size="small" @click="refreshPreview">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>
            </template>
            <div class="preview-content" v-html="previewHtml"></div>
          </el-card>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Back, View, Refresh } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createTemplate, updateTemplate, getTemplateDetail, previewTemplate } from '@/api/templates'
import type { Template } from '@/api/templates'

const route = useRoute()
const router = useRouter()

// 是否为编辑模式
const isEdit = computed(() => !!route.params.id)

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const formData = reactive<Partial<Template>>({
  name: '',
  description: '',
  match_gender: 'all',
  match_age_min: null,
  match_age_max: null,
  match_interests: '',
  html_content: '',
  is_active: 1
})

// 表单验证规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' }
  ],
  html_content: [
    { required: true, message: '请输入HTML模板内容', trigger: 'blur' }
  ]
})

// 加载状态
const loading = ref(false)
const submitting = ref(false)

// 预览控制
const showPreview = ref(false)
const previewHtml = ref('')

// 刷新预览
const refreshPreview = async () => {
  if (!formData.html_content) return

  if (isEdit.value && route.params.id) {
    try {
      previewHtml.value = await previewTemplate(Number(route.params.id))
      return
    } catch (error) {
      console.error('获取后端预览失败，使用本地占位符替换：', error)
    }
  }

  previewHtml.value = formData.html_content
    .replace(/\{\{name\}\}/g, '张三')
    .replace(/\{\{department\}\}/g, '技术部')
    .replace(/\{\{position\}\}/g, '工程师')
    .replace(/\{\{blessing\}\}/g, '祝您生日快乐，事业蒸蒸日上！')
}

// 切换预览
const togglePreview = () => {
  showPreview.value = !showPreview.value
  if (showPreview.value) {
    refreshPreview()
  }
}

// 加载模板详情（编辑模式）
const loadTemplateDetail = async () => {
  if (!isEdit.value) return
  
  loading.value = true
  try {
    const id = Number(route.params.id)
    const detail = await getTemplateDetail(id)
    
    Object.assign(formData, {
      name: detail.name,
      description: detail.description || '',
      match_gender: detail.match_gender || 'all',
      match_age_min: detail.match_age_min,
      match_age_max: detail.match_age_max,
      match_interests: detail.match_interests || '',
      html_content: detail.html_content,
      is_active: detail.is_active
    })
  } catch (error) {
    console.error('加载模板详情失败：', error)
    ElMessage.error('加载模板详情失败')
    router.back()
  } finally {
    loading.value = false
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      if (isEdit.value) {
        await updateTemplate(Number(route.params.id), formData as Template)
        ElMessage.success('修改成功')
      } else {
        await createTemplate(formData as Template)
        ElMessage.success('添加成功')
      }
      
      router.push('/templates')
    } catch (error) {
      console.error('提交失败：', error)
      ElMessage.error(isEdit.value ? '修改失败' : '添加失败')
    } finally {
      submitting.value = false
    }
  })
}

// 返回
const handleBack = () => {
  router.back()
}

// 页面加载时获取数据
onMounted(() => {
  loadTemplateDetail()
})
</script>

<style scoped>
.template-edit-container {
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

.header-actions {
  display: flex;
  gap: 12px;
}

.edit-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  padding: 20px;
}

.edit-content.with-preview {
  grid-template-columns: 1fr 1fr;
}

.html-editor {
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.editor-tips {
  margin-top: 8px;
  padding: 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.editor-tips p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #606266;
}

.preview-panel {
  position: sticky;
  top: 20px;
  height: fit-content;
  max-height: calc(100vh - 140px);
  overflow-y: auto;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-content {
  min-height: 400px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 20px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .edit-content.with-preview {
    grid-template-columns: 1fr;
  }

  .preview-panel {
    position: static;
    max-height: none;
  }

  .el-form-item__label {
    width: 100px !important;
  }
}
</style>