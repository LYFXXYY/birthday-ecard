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
          </div>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="120px"
        v-loading="loading"
        style="max-width: 800px; margin: 0 auto; padding: 20px;"
      >
        <!-- 文件夹模板专属信息（只读） -->
        <template v-if="isEdit && formData.folder_path">
          <el-divider content-position="left">模板文件</el-divider>

          <el-form-item label="缩略图" v-if="formData.thumbnail">
            <div class="thumbnail-preview">
              <img :src="getThumbnailUrl()" alt="模板缩略图" />
            </div>
          </el-form-item>

          <el-form-item label="模板素材">
            <div class="asset-gallery" v-if="imageAssets.length > 0">
              <div v-for="asset in imageAssets" :key="asset.name" class="asset-item">
                <img :src="asset.url" :alt="asset.name" />
              </div>
            </div>
            <el-empty v-else description="暂无图片素材" :image-size="60" />
          </el-form-item>
        </template>

        <el-form-item label="模板名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入模板名称" />
        </el-form-item>

        <el-form-item label="模板描述" prop="description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入模板描述"
          />
        </el-form-item>

        <el-divider content-position="left">匹配规则</el-divider>

        <el-form-item label="适用职级" prop="employee_level">
          <el-select v-model="formData.employee_level" placeholder="请选择适用职级" style="width: 200px">
            <el-option label="管理层" value="management" />
            <el-option label="经理" value="manager" />
            <el-option label="员工" value="employee" />
            <el-option label="通用（所有职级）" value="all" />
          </el-select>
        </el-form-item>

        <el-form-item label="模板页数" prop="page_count">
          <el-select v-model="formData.page_count" placeholder="请选择页数" style="width: 200px">
            <el-option label="4 页（员工）" :value="4" />
            <el-option label="7 页（管理层/经理）" :value="7" />
          </el-select>
        </el-form-item>

        <el-form-item label="默认祝福语" prop="default_blessing_id">
          <el-select
            v-model="formData.default_blessing_id"
            placeholder="请选择默认祝福语（可选）"
            clearable
            @clear="handleClearBlessing"
            style="width: 100%"
          >
            <el-option
              v-for="blessing in blessings"
              :key="blessing.id"
              :label="blessing.content.length > 50 ? blessing.content.slice(0, 50) + '...' : blessing.content"
              :value="blessing.id"
            />
          </el-select>
          <div class="hint-text">如果选择，生成贺卡时将使用该祝福语替换 {{ blessingPlaceholder }} 占位符。</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSubmit" :loading="submitting">
            {{ isEdit ? '保存修改' : '提交' }}
          </el-button>
          <el-button @click="handleBack">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Back } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createTemplate, updateTemplate, getTemplateDetail } from '@/api/templates'
import { getBlessingList } from '@/api/blessings'
import type { Template } from '@/api/templates'
import type { Blessing } from '@/api/blessings'

const route = useRoute()
const router = useRouter()

// 用于模板中显示占位符名称（避免 Vue 模板解析嵌套花括号）
const blessingPlaceholder = '{{blessing}}'

// 是否为编辑模式
const isEdit = computed(() => !!route.params.id)

// 表单引用
const formRef = ref<FormInstance>()

// 表单数据
const formData = reactive<Partial<Template>>({
  name: '',
  description: '',
  employee_level: 'all',
  page_count: 4,
  default_blessing_id: null,
  folder_path: '',
  thumbnail: ''
})

// 表单验证规则
const rules = reactive<FormRules>({
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' }
  ],
  page_count: [
    { required: true, message: '请选择模板页数', trigger: 'change' }
  ]
})

// 加载状态
const loading = ref(false)
const submitting = ref(false)

const blessings = ref<Blessing[]>([])

// 文件夹素材列表
const folderAssets = ref<Array<{ name: string; url: string; isImage: boolean }>>([])

// 只显示图片素材
const imageAssets = computed(() => folderAssets.value.filter(a => a.isImage))

// 获取缩略图 URL
const getThumbnailUrl = () => {
  if (!formData.thumbnail || !formData.folder_path) return ''
  // 使用 /api/templates/thumbnail/:folderPath/:filePath 接口
  return `/api/templates/thumbnail/${formData.folder_path}/${formData.thumbnail}`
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
      employee_level: detail.employee_level || 'all',
      page_count: detail.page_count || 4,
      default_blessing_id: detail.default_blessing_id ?? null,
      folder_path: detail.folder_path || '',
      thumbnail: detail.thumbnail || ''
    })

    // 加载文件夹素材
    if (detail.folder_path) {
      await loadFolderAssets(detail.folder_path)
    }
  } catch (error) {
    console.error('加载模板详情失败：', error)
    ElMessage.error('加载模板详情失败')
    router.back()
  } finally {
    loading.value = false
  }
}

// 加载文件夹素材列表
const loadFolderAssets = async (folderPath: string) => {
  try {
    // 调用后端 API 获取文件夹内的文件列表
    const { getTemplateFolderAssets } = await import('@/api/templates')
    const assets = await getTemplateFolderAssets(folderPath)
    folderAssets.value = assets.map((asset: any) => ({
      name: asset.name,
      url: asset.url,
      isImage: asset.isImage
    }))
  } catch (error) {
    console.error('加载文件夹素材失败：', error)
    folderAssets.value = []
  }
}

// 清除祝福语选择
const handleClearBlessing = () => {
  formData.default_blessing_id = null
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    
    submitting.value = true
    try {
      // 确保清除的祝福语 ID 正确传递为 null
      if (!formData.default_blessing_id) {
        (formData as any).default_blessing_id = null
      }
      
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

const loadBlessings = async () => {
  try {
    blessings.value = await getBlessingList({ is_active: 1 })
  } catch (error) {
    console.error('加载祝福语列表失败：', error)
    blessings.value = []
  }
}

// 返回
const handleBack = () => {
  router.back()
}

// 页面加载时获取数据
onMounted(() => {
  loadBlessings()
  loadTemplateDetail()
})
</script>

<style scoped>
.template-edit-container {
  padding: 0;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.hint-text {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

.thumbnail-preview {
  width: 200px;
  height: 150px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover;
}

.asset-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  width: 100%;
}

.asset-item {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  transition: all 0.2s;
}

.asset-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.asset-item img {
  width: 100%;
  height: 80px;
  object-fit: cover;
  display: block;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .el-form-item__label {
    width: 100px !important;
  }

  .asset-gallery {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>
