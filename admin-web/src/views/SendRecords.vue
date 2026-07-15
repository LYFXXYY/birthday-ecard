<template>
  <div class="send-records-container">
    <el-card>
      <!-- 页面头部 -->
      <template #header>
        <div class="card-header">
          <span class="title">发送记录</span>
        </div>
      </template>

      <!-- 统计卡片 -->
      <div class="stats-section">
        <el-row :gutter="16">
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-total">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总发送数</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-success">
              <div class="stat-value">{{ stats.success }}</div>
              <div class="stat-label">成功</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-failed">
              <div class="stat-value">{{ stats.failed }}</div>
              <div class="stat-label">失败</div>
            </div>
          </el-col>
          <el-col :xs="12" :sm="6">
            <div class="stat-card stat-rate">
              <div class="stat-value">{{ stats.success_rate }}%</div>
              <div class="stat-label">成功率</div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 筛选表单 -->
      <el-form :model="searchForm" inline class="search-form">
        <el-form-item label="发送状态">
          <el-select v-model="searchForm.status" placeholder="全部" clearable style="width: 160px">
            <el-option label="成功" value="success" />
            <el-option label="失败" value="failed" />
            <el-option label="待发送" value="pending" />
            <el-option label="录制中" value="recording" />
            <el-option label="已录制" value="recorded" />
            <el-option label="发送中" value="sending" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="handleSearch">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="handleReset">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 数据表格 -->
      <el-table
        :data="tableData"
        v-loading="loading"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-content">
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="部门">{{ row.employee?.department || '-' }}</el-descriptions-item>
                <el-descriptions-item label="职级">
                  <el-tag :type="getLevelTagType(row.employee?.level)" size="small">
                    {{ getLevelText(row.employee?.level) }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="短信模板ID">
                  <el-tag v-if="row.video_template_id" type="info" size="small">{{ row.video_template_id }}</el-tag>
                  <span v-else class="text-muted">未配置</span>
                </el-descriptions-item>
                <el-descriptions-item label="姓名">{{ row.employee?.name || '-' }}</el-descriptions-item>
                <el-descriptions-item label="性别">
                  <span v-if="row.employee?.gender === 'male'">先生</span>
                  <span v-else-if="row.employee?.gender === 'female'">女士</span>
                  <span v-else>-</span>
                </el-descriptions-item>
                <el-descriptions-item label="失败原因">
                  <span v-if="row.error_message" class="error-text">{{ row.error_message }}</span>
                  <span v-else>-</span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="employee.name" label="员工姓名" width="100" />
        <el-table-column prop="employee.phone" label="手机号" width="130" />
        <el-table-column prop="send_status" label="发送状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.send_status)">
              {{ getStatusText(row.send_status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发送时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.send_time) }}
          </template>
        </el-table-column>
        <el-table-column label="投递状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.delivery_status" :type="getDeliveryType(row.delivery_status)" size="small">
              {{ getDeliveryText(row.delivery_status) }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="投递时间" width="170">
          <template #default="{ row }">
            {{ formatDateTime(row.delivery_time) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button
              type="info"
              size="small"
              @click="handlePreviewVideo(row)"
              :disabled="!row.video_url"
            >
              <el-icon><VideoPlay /></el-icon>
              预览
            </el-button>
            <el-button
              type="primary"
              size="small"
              @click="handleTestSend(row.employee_id)"
              :loading="sendingId === row.employee_id"
              :disabled="sendingId !== null || row.send_status === 'success'"
            >
              {{ sendingId === row.employee_id ? `发送中 ${sendProgress}%` : '重发' }}
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 手机视频预览对话框 -->
    <el-dialog
      v-model="previewVisible"
      title="贺卡视频预览"
      width="440px"
      :close-on-click-modal="true"
      class="phone-preview-dialog"
      destroy-on-close
    >
      <div class="phone-frame">
        <div class="phone-notch"></div>
        <div class="phone-status-bar">
          <span class="phone-time">{{ currentTime }}</span>
          <span class="phone-icons">●●●</span>
        </div>
        <div class="phone-screen phone-screen-video">
          <video
            v-if="previewVideoUrl"
            :src="previewVideoUrl"
            class="video-player"
            controls
            autoplay
            playsinline
            loop
          ></video>
          <div v-else class="no-video">
            <el-icon :size="48"><VideoPlay /></el-icon>
            <p>该记录无视频</p>
          </div>
        </div>
        <div class="phone-home-bar"></div>
      </div>
      <template #footer>
        <div class="preview-footer">
          <el-button type="primary" @click="openVideoFullscreen">全屏播放</el-button>
          <el-button @click="previewVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Search, Refresh, VideoPlay } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getRecordList, getRecordStats, testSend, deleteRecord } from '@/api/records'
import type { SendRecord, RecordQueryParams } from '@/api/records'

// 统计数据
const stats = reactive({
  total: 0,
  success: 0,
  failed: 0,
  pending: 0,
  success_rate: 0
})

// 搜索表单
const searchForm = reactive<RecordQueryParams>({
  status: undefined,
  startDate: undefined,
  endDate: undefined
})

// 日期范围
const dateRange = ref<string[]>([])

// 表格数据
const tableData = ref<SendRecord[]>([])
const loading = ref(false)
const sendingId = ref<number | null>(null)
const sendProgress = ref(0)

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 格式化日期时间：将 ISO 字符串转为 YYYY-MM-DD HH:mm:ss
const formatDateTime = (value: string | Date | null) => {
  if (!value) return '-'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '-'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 职级中文映射
const getLevelText = (level?: string) => {
  const map: Record<string, string> = {
    management: '管理层',
    manager: '三级经理',
    employee: '普通员工'
  }
  return map[level || ''] || '普通员工'
}

// 职级标签颜色
const getLevelTagType = (level?: string) => {
  const map: Record<string, string> = {
    management: 'danger',
    manager: 'warning',
    employee: ''
  }
  return map[level || ''] || ''
}

// 获取状态类型
const getStatusType = (status: string) => {
  const typeMap: Record<string, any> = {
    success: 'success',
    failed: 'danger',
    pending: 'warning',
    recording: 'info',
    recorded: '',
    sending: ''
  }
  return typeMap[status] || 'info'
}

// 获取状态文字
const getStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    success: '成功',
    failed: '失败',
    pending: '待发送',
    recording: '录制中',
    recorded: '已录制',
    sending: '发送中'
  }
  return textMap[status] || status
}

// 投递状态标签颜色
const getDeliveryType = (status: string) => {
  const map: Record<string, any> = {
    Delivered: 'success',
    delivered: 'success',
    Failed: 'danger',
    failed: 'danger',
    Rejected: 'danger',
    rejected: 'danger',
    Pending: 'warning',
    pending: 'warning'
  }
  return map[status] || 'info'
}

// 投递状态中文
const getDeliveryText = (status: string) => {
  const map: Record<string, string> = {
    Delivered: '已送达',
    delivered: '已送达',
    Failed: '投递失败',
    failed: '投递失败',
    Rejected: '已拒绝',
    rejected: '已拒绝',
    Pending: '投递中',
    pending: '投递中',
    Expired: '已过期',
    expired: '已过期'
  }
  return map[status] || status
}

// 加载统计数据
const loadStats = async () => {
  try {
    const data = await getRecordStats()
    Object.assign(stats, data)
  } catch (error) {
    console.error('加载统计数据失败：', error)
  }
}

// 加载记录列表
const loadRecords = async () => {
  loading.value = true
  try {
    const params: RecordQueryParams = {
      ...searchForm,
      page: pagination.page,
      pageSize: pagination.pageSize
    }
    
    const res = await getRecordList(params)
    tableData.value = res.list
    pagination.total = res.total
  } catch (error) {
    console.error('加载记录列表失败：', error)
    tableData.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 日期改变
const handleDateChange = (dates: string[] | null) => {
  if (dates && dates.length === 2) {
    searchForm.startDate = dates[0]
    searchForm.endDate = dates[1]
  } else {
    searchForm.startDate = undefined
    searchForm.endDate = undefined
  }
}

// 搜索
const handleSearch = () => {
  pagination.page = 1
  loadRecords()
}

// 重置
const handleReset = () => {
  searchForm.status = undefined
  searchForm.startDate = undefined
  searchForm.endDate = undefined
  dateRange.value = []
  handleSearch()
}

// 分页大小改变
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadRecords()
}

// 页码改变
const handlePageChange = (page: number) => {
  pagination.page = page
  loadRecords()
}

// 测试发送
const handleTestSend = async (employeeId: number) => {
  sendingId.value = employeeId
  sendProgress.value = 0

  // 模拟进度：每 3 秒增长一点，最高到 95%
  const progressTimer = setInterval(() => {
    if (sendProgress.value < 95) {
      sendProgress.value = Math.min(sendProgress.value + Math.floor(Math.random() * 3) + 1, 95)
    }
  }, 3000)

  try {
    await testSend(employeeId)
    clearInterval(progressTimer)
    sendProgress.value = 100
    ElMessage.success('发送成功')
    await Promise.all([loadRecords(), loadStats()])
  } catch (error) {
    clearInterval(progressTimer)
    ElMessage.error('发送失败，请查看后台日志确认状态')
  } finally {
    // 短暂展示 100% 后重置
    setTimeout(() => {
      sendingId.value = null
      sendProgress.value = 0
    }, 800)
  }
}

// 删除记录
const handleDelete = async (row: SendRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除员工「${row.employee?.name || '未知'}」的这条发送记录吗？`,
      '提示',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    if (!row.id) return
    await deleteRecord(row.id)
    ElMessage.success('删除成功')
    await Promise.all([loadRecords(), loadStats()])
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败：', error)
      ElMessage.error('删除失败')
    }
  }
}

// --- 手机视频预览功能 ---
const previewVisible = ref(false)
const previewVideoUrl = ref('')
const currentTime = ref('')

// 获取当前时间（模拟手机状态栏）
const updateTime = () => {
  const now = new Date()
  currentTime.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

// 打开视频预览
const handlePreviewVideo = (row: SendRecord) => {
  if (!row.video_url) {
    ElMessage.warning('该记录无视频')
    return
  }
  // 将绝对 URL 转为相对路径（后端存的是 http://localhost:3000/video/xxx.mp4）
  // 相对路径通过 Vite 代理访问，开发/生产通用
  try {
    const url = new URL(row.video_url)
    previewVideoUrl.value = url.pathname
  } catch {
    // 已是相对路径则直接使用
    previewVideoUrl.value = row.video_url
  }
  updateTime()
  previewVisible.value = true
}

// 全屏播放视频
const openVideoFullscreen = () => {
  const video = document.querySelector('.video-player') as HTMLVideoElement | null
  if (video) {
    if (video.requestFullscreen) {
      video.requestFullscreen()
    } else {
      // 兼容 webkit 前缀（Safari）
      const v = video as any
      if (v.webkitRequestFullscreen) {
        v.webkitRequestFullscreen()
      }
    }
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadStats()
  loadRecords()
})
</script>

<style scoped>
.send-records-container {
  padding: 0;
}

.title {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}

.stats-section {
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  color: white;
  margin-bottom: 16px;
}

.stat-total {
  background: linear-gradient(135deg, var(--primary-color, #0085CC) 0%, var(--primary-light, #339AD6) 100%);
}

.stat-success {
  background: linear-gradient(135deg, #67C23A 0%, #85ce61 100%);
}

.stat-failed {
  background: linear-gradient(135deg, #F56C6C 0%, #f78989 100%);
}

.stat-rate {
  background: linear-gradient(135deg, var(--accent-color, #95C11F) 0%, #b0d44a 100%);
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.search-form {
  margin-bottom: 20px;
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.error-text {
  color: #f56c6c;
  cursor: pointer;
}

.text-muted {
  color: #c0c4cc;
  font-size: 13px;
}

/* 展开内容样式 */
.expand-content {
  padding: 16px 20px;
}

/* 手机预览对话框 */
:deep(.phone-preview-dialog .el-dialog__body) {
  padding: 16px 20px;
  display: flex;
  justify-content: center;
  background: #f0f2f5;
}

.phone-frame {
  width: 375px;
  height: 680px;
  background: #000;
  border-radius: 40px;
  padding: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3), inset 0 0 0 2px #333;
  position: relative;
  display: flex;
  flex-direction: column;
}

.phone-notch {
  width: 120px;
  height: 28px;
  background: #000;
  border-radius: 0 0 16px 16px;
  margin: 0 auto;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.phone-status-bar {
  height: 36px;
  background: #000;
  border-radius: 28px 28px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.phone-icons {
  font-size: 8px;
  letter-spacing: 2px;
}

.phone-screen {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}

.phone-screen-video {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  overflow: hidden;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.no-video {
  text-align: center;
  color: #909399;
}

.no-video p {
  margin-top: 12px;
  font-size: 14px;
}

.phone-home-bar {
  height: 28px;
  background: #000;
  border-radius: 0 0 28px 28px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.phone-home-bar::after {
  content: '';
  width: 100px;
  height: 4px;
  background: #666;
  border-radius: 2px;
}

.preview-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .search-form {
    flex-direction: column;
  }

  .search-form .el-form-item {
    margin-bottom: 12px;
  }

  .search-form .el-input,
  .search-form .el-select {
    width: 100% !important;
  }

  .stat-value {
    font-size: 24px;
  }

  .stat-label {
    font-size: 12px;
  }
}
</style>
