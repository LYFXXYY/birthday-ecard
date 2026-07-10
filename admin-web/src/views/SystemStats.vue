<template>
  <div class="system-stats">
    <h2 class="page-title">系统监控</h2>

    <!-- 顶部：服务健康状态 -->
    <el-row :gutter="20" class="section">
      <el-col :xs="12" :sm="6" v-for="item in healthCards" :key="item.key">
        <el-card shadow="hover" class="health-card">
          <div class="health-indicator">
            <span
              class="status-dot"
              :class="item.statusClass"
            ></span>
            <span class="status-text" :class="item.statusClass">{{ item.label }}</span>
          </div>
          <div class="health-value">{{ item.value }}</div>
          <div class="health-desc">{{ item.desc }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 中间：发送统计 -->
    <el-row :gutter="20" class="section">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="总发送量" :value="stats.send_stats.total" />
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="成功数" :value="stats.send_stats.success">
            <template #suffix>
              <span style="color: #67C23A; font-size: 14px">&#10003;</span>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="失败数" :value="stats.send_stats.failed">
            <template #suffix>
              <span style="color: #F56C6C; font-size: 14px">&#10007;</span>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="成功率" :value="stats.send_stats.success_rate" :precision="2">
            <template #suffix>%</template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 告警信息 -->
    <el-card v-if="extended.alerts.length > 0" shadow="hover" class="section alerts-card">
      <template #header>
        <span class="section-title alert-title">系统告警</span>
      </template>
      <div v-for="(alert, idx) in extended.alerts" :key="idx" class="alert-item">
        <el-tag :type="alertTagType(alert.level)" size="small" effect="dark">
          {{ alert.level === 'error' ? '严重' : alert.level === 'warning' ? '警告' : '提示' }}
        </el-tag>
        <span class="alert-message">{{ alert.message }}</span>
      </div>
    </el-card>
    <el-card v-else shadow="hover" class="section alerts-card">
      <template #header>
        <span class="section-title">系统告警</span>
      </template>
      <div class="no-alerts">暂无告警，系统运行正常</div>
    </el-card>

    <!-- 定时任务状态 -->
    <el-card shadow="hover" class="section">
      <template #header>
        <span class="section-title">定时任务</span>
      </template>
      <el-table :data="cronJobList" stripe size="small">
        <el-table-column prop="name" label="任务名称" width="140" />
        <el-table-column prop="schedule" label="调度规则" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-dot-small" :class="cronStatusClass(row.status)"></span>
            {{ cronStatusText(row.status) }}
          </template>
        </el-table-column>
        <el-table-column label="上次执行" width="180">
          <template #default="{ row }">
            {{ formatCronTime(row.last_run) }}
          </template>
        </el-table-column>
        <el-table-column prop="message" label="说明" min-width="200" />
      </el-table>
    </el-card>

    <!-- 内存使用 -->
    <el-row :gutter="20" class="section">
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="内存占用 (RSS)" :value="extended.memory.rss">
            <template #suffix>MB</template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="堆内存已用" :value="extended.memory.heapUsed">
            <template #suffix>MB</template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="堆内存总量" :value="extended.memory.heapTotal">
            <template #suffix>MB</template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="堆使用率" :value="extended.memory.usagePercent">
            <template #suffix>%</template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 刷新状态提示 -->
    <div class="refresh-info">
      <el-tag type="info" size="small">
        每 3 分钟自动刷新 | 上次更新: {{ lastRefresh }}
      </el-tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getSystemHealth, getSystemStats, getExtendedStats } from '@/api/monitor'
import type { SystemHealth, SystemStats, ExtendedStats, CronJob, Alert } from '@/api/monitor'

// 健康状态数据
const health = ref<SystemHealth>({
  sender_service: 'unknown',
  monitor_service: 'unknown',
  database: 'unknown',
  last_heartbeat: ''
})

// 统计数据
const stats = ref<SystemStats>({
  send_stats: { total: 0, success: 0, failed: 0, success_rate: 0 },
  template_usage: [],
  today_count: 0,
  level_stats: []
})

const lastRefresh = ref('--')

// 扩展监控数据
const extended = ref<ExtendedStats>({
  memory: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0, usagePercent: 0 },
  cron_jobs: {},
  alerts: []
})

// 健康状态卡片配置
const healthCards = computed(() => [
  {
    key: 'sender',
    label: '发送服务',
    value: statusLabel(health.value.sender_service),
    desc: '生日贺卡发送进程',
    statusClass: statusClass(health.value.sender_service)
  },
  {
    key: 'monitor',
    label: '监控服务',
    value: statusLabel(health.value.monitor_service),
    desc: '系统监控进程',
    statusClass: statusClass(health.value.monitor_service)
  },
  {
    key: 'database',
    label: '数据库',
    value: statusLabel(health.value.database),
    desc: 'MySQL 连接状态',
    statusClass: health.value.database === 'connected' ? 'status-healthy' : 'status-unhealthy'
  },
  {
    key: 'heartbeat',
    label: '最后心跳',
    value: health.value.last_heartbeat ? formatTime(health.value.last_heartbeat) : '暂无',
    desc: '发送服务最后活跃时间',
    statusClass: health.value.last_heartbeat ? 'status-healthy' : 'status-unhealthy'
  }
])

// 辅助函数
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    healthy: '正常',
    unhealthy: '异常',
    connected: '已连接',
    disconnected: '未连接',
    unknown: '未知'
  }
  return map[status] || status
}

function statusClass(status: string): string {
  if (status === 'healthy' || status === 'connected') return 'status-healthy'
  if (status === 'unhealthy' || status === 'disconnected') return 'status-unhealthy'
  return 'status-unknown'
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function cronStatusClass(status: string): string {
  const map: Record<string, string> = {
    success: 'status-healthy',
    running: 'status-running',
    warning: 'status-warning',
    error: 'status-unhealthy',
    waiting: 'status-unknown'
  }
  return map[status] || 'status-unknown'
}

function cronStatusText(status: string): string {
  const map: Record<string, string> = {
    success: '正常',
    running: '运行中',
    warning: '警告',
    error: '异常',
    waiting: '等待中'
  }
  return map[status] || status
}

function formatCronTime(iso: string | null): string {
  if (!iso) return '尚未执行'
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

function alertTagType(level: string): string {
  const map: Record<string, string> = { error: 'danger', warning: 'warning', info: 'info' }
  return map[level] || 'info'
}

// 定时任务列表（按顺序展示）
const cronJobList = computed(() => {
  const jobs = extended.value.cron_jobs
  return Object.entries(jobs).map(([key, job]) => ({ key, ...job }))
})

// 数据加载
const fetchHealth = async () => {
  try {
    const data = await getSystemHealth()
    health.value = data
  } catch {
    // 请求拦截器已处理错误提示
  }
}

const fetchStats = async () => {
  try {
    const data = await getSystemStats()
    stats.value = data
  } catch {
    // 请求拦截器已处理错误提示
  }
}

const fetchExtended = async () => {
  try {
    const data = await getExtendedStats()
    extended.value = data
  } catch {
    // 请求拦截器已处理错误提示
  }
}

const fetchAll = async () => {
  await Promise.all([fetchHealth(), fetchStats(), fetchExtended()])
  lastRefresh.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

// 自动刷新（3 分钟）
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchAll()
  refreshTimer = setInterval(fetchAll, 180000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
})
</script>

<style scoped>
.system-stats {
  padding: 0;
}

.page-title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.section {
  margin-bottom: 20px;
}

/* 健康状态卡片 */
.health-card {
  text-align: center;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.health-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.status-healthy,
.status-text.status-healthy {
  color: #67C23A;
}

.status-dot.status-healthy {
  background-color: #67C23A;
  box-shadow: 0 0 6px rgba(103, 194, 58, 0.5);
}

.status-dot.status-unhealthy,
.status-text.status-unhealthy {
  color: #F56C6C;
}

.status-dot.status-unhealthy {
  background-color: #F56C6C;
  box-shadow: 0 0 6px rgba(245, 108, 108, 0.5);
}

.status-dot.status-unknown,
.status-text.status-unknown {
  color: #909399;
}

.status-dot.status-unknown {
  background-color: #909399;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
}

.health-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.health-desc {
  font-size: 12px;
  color: #909399;
}

/* 统计卡片 */
.stat-card {
  text-align: center;
}

.stat-card :deep(.el-statistic) {
  justify-content: center;
}

/* 刷新提示 */
.refresh-info {
  text-align: center;
  margin-top: 16px;
}

/* 区块标题 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.alert-title {
  color: #E6A23C;
}

/* 告警区域 */
.alerts-card {
  border-left: 3px solid #E6A23C;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.alert-item:last-child {
  border-bottom: none;
}

.alert-message {
  font-size: 14px;
  color: #606266;
}

.no-alerts {
  text-align: center;
  color: #67C23A;
  padding: 12px 0;
  font-size: 14px;
}

/* 定时任务状态小圆点 */
.status-dot-small {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.status-dot-small.status-healthy {
  background-color: #67C23A;
  box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
}

.status-dot-small.status-running {
  background-color: #409EFF;
  box-shadow: 0 0 4px rgba(64, 158, 255, 0.5);
  animation: pulse 1.5s infinite;
}

.status-dot-small.status-warning {
  background-color: #E6A23C;
  box-shadow: 0 0 4px rgba(230, 162, 60, 0.5);
}

.status-dot-small.status-unhealthy {
  background-color: #F56C6C;
  box-shadow: 0 0 4px rgba(245, 108, 108, 0.5);
}

.status-dot-small.status-unknown {
  background-color: #909399;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
