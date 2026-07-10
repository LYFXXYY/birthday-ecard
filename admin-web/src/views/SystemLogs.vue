<template>
  <div class="system-logs-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span class="title">系统日志</span>
          <div class="header-actions">
            <el-button :icon="Refresh" circle @click="loadAll" />
          </div>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-select v-model="filters.level" placeholder="日志级别" clearable style="width: 120px" @change="loadLogs">
          <el-option label="信息" value="info" />
          <el-option label="警告" value="warn" />
          <el-option label="错误" value="error" />
        </el-select>
        <el-select v-model="filters.category" placeholder="分类" clearable style="width: 140px" @change="loadLogs">
          <el-option label="定时任务" value="scheduler" />
          <el-option label="心跳监控" value="heartbeat" />
          <el-option label="发送服务" value="send" />
          <el-option label="系统" value="system" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
          @change="handleDateChange"
        />
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- 统计摘要 -->
      <div class="stats-summary" v-if="stats">
        <el-tag type="info">总记录：{{ stats.total_count }}</el-tag>
        <el-tag type="success">今日：{{ stats.today_count }}</el-tag>
        <el-tag type="danger" v-if="stats.recent_errors > 0">近24h错误：{{ stats.recent_errors }}</el-tag>
      </div>

      <!-- 日志表格 -->
      <el-table
        v-loading="loading"
        :data="logs"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="created_at" label="时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="level" label="级别" width="80">
          <template #default="{ row }">
            <el-tag :type="getLevelTagType(row.level)" size="small">
              {{ getLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="100">
          <template #default="{ row }">
            {{ getCategoryText(row.category) }}
          </template>
        </el-table-column>
        <el-table-column prop="message" label="内容" min-width="300" show-overflow-tooltip />
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="loadLogs"
          @current-change="loadLogs"
        />
      </div>

      <div v-if="!loading && logs.length === 0" class="empty-tip">
        <el-empty description="暂无系统日志" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { getSystemLogs, getSystemLogStats } from '@/api/systemLogs'
import type { SystemLog, SystemLogStats } from '@/api/systemLogs'

const loading = ref(false)
const logs = ref<SystemLog[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const stats = ref<SystemLogStats | null>(null)
const dateRange = ref<[string, string] | null>(null)

const filters = reactive({
  level: '',
  category: '',
  startDate: '',
  endDate: ''
})

const getLevelText = (level: string) => {
  const map: Record<string, string> = { info: '信息', warn: '警告', error: '错误' }
  return map[level] || level
}

const getLevelTagType = (level: string) => {
  const map: Record<string, string> = { info: 'info', warn: 'warning', error: 'danger' }
  return map[level] || 'info'
}

const getCategoryText = (category: string) => {
  const map: Record<string, string> = {
    scheduler: '定时任务',
    heartbeat: '心跳监控',
    send: '发送服务',
    system: '系统'
  }
  return map[category] || category
}

const formatTime = (time: string) => {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

const handleDateChange = (val: [string, string] | null) => {
  filters.startDate = val?.[0] || ''
  filters.endDate = val?.[1] || ''
  loadLogs()
}

const handleReset = () => {
  filters.level = ''
  filters.category = ''
  filters.startDate = ''
  filters.endDate = ''
  dateRange.value = null
  currentPage.value = 1
  loadLogs()
}

const loadLogs = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    if (filters.level) params.level = filters.level
    if (filters.category) params.category = filters.category
    if (filters.startDate) params.startDate = filters.startDate
    if (filters.endDate) params.endDate = filters.endDate

    const result = await getSystemLogs(params)
    logs.value = result.list
    total.value = result.total
  } catch (error) {
    console.error('加载系统日志失败：', error)
    logs.value = []
  } finally {
    loading.value = false
  }
}

const loadStats = async () => {
  try {
    stats.value = await getSystemLogStats()
  } catch (error) {
    console.error('加载统计失败：', error)
  }
}

const loadAll = () => {
  loadLogs()
  loadStats()
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.system-logs-container {
  padding: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  font-size: 18px;
  font-weight: bold;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.stats-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.pagination-wrapper {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.empty-tip {
  padding: 40px 0;
  text-align: center;
}
</style>
