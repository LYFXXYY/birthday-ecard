<template>
  <div class="dashboard-container">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" style="--card-accent: var(--primary-color)">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><User /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalEmployees }}</div>
          <div class="stat-label">员工总数</div>
        </div>
      </div>

      <div class="stat-card" style="--card-accent: var(--accent-color)">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><Star /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.todayBirthdays }}</div>
          <div class="stat-label">今日生日</div>
        </div>
      </div>

      <div class="stat-card" style="--card-accent: var(--secondary-color)">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><Calendar /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.tomorrowBirthdays }}</div>
          <div class="stat-label">明日生日</div>
        </div>
      </div>

      <div class="stat-card" style="--card-accent: #67C23A">
        <div class="stat-icon-wrap">
          <el-icon :size="28"><Message /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stats.totalSent }}</div>
          <div class="stat-label">总发送数</div>
        </div>
      </div>
    </div>

    <!-- 今日生日员工列表 -->
    <el-card class="birthday-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>今日生日员工</span>
          <el-button type="primary" size="small" @click="refreshBirthdays">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-empty v-if="todayBirthdays.length === 0" description="今天没有生日的员工" />
      
      <div v-else class="birthday-list">
        <div v-for="employee in todayBirthdays" :key="employee.id" class="birthday-item">
          <div class="employee-info">
            <div class="employee-name">{{ employee.name }}</div>
            <div class="employee-detail">{{ employee.department }} - {{ employee.phone }}</div>
          </div>
          <div class="send-action-area">
            <el-button 
              v-if="employee.id !== undefined"
              :type="sentEmployeeIds.has(employee.id) ? 'info' : 'success'" 
              :disabled="sentEmployeeIds.has(employee.id) || sendingId === employee.id"
              :loading="sendingId === employee.id"
              size="small" 
              @click="handleTestSend(employee.id)"
            >
              {{ sentEmployeeIds.has(employee.id) ? '已发送' : (sendingId === employee.id ? `发送中 ${sendProgress}%` : '测试发送') }}
            </el-button>
            <div class="send-progress-bar" v-if="sendingId === employee.id">
              <div class="send-progress-fill" :style="{ width: sendProgress + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 系统监控面板 -->
    <el-card class="monitor-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>系统监控</span>
          <el-tag type="info" size="small">
            上次更新: {{ monitorLastRefresh }}
          </el-tag>
        </div>
      </template>

      <!-- 健康状态 -->
      <el-row :gutter="16" class="monitor-section">
        <el-col :xs="12" :sm="6" v-for="item in healthCards" :key="item.key">
          <div class="health-mini-card">
            <div class="health-indicator">
              <span class="status-dot" :class="item.statusClass"></span>
              <span class="health-label">{{ item.label }}</span>
            </div>
            <div class="health-status-text" :class="item.statusClass">{{ item.value }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 内存与发送统计 -->
      <el-row :gutter="16" class="monitor-section">
        <el-col :xs="12" :sm="6">
          <div class="mini-stat">
            <div class="mini-stat-value">{{ monitorStats.send_stats.total }}</div>
            <div class="mini-stat-label">总发送量</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="mini-stat">
            <div class="mini-stat-value">{{ monitorStats.send_stats.success_rate }}<span class="mini-stat-unit">%</span></div>
            <div class="mini-stat-label">成功率</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="mini-stat">
            <div class="mini-stat-value">{{ extendedStats.memory.rss }}<span class="mini-stat-unit">MB</span></div>
            <div class="mini-stat-label">内存占用</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="mini-stat">
            <div class="mini-stat-value">{{ extendedStats.memory.usagePercent }}<span class="mini-stat-unit">%</span></div>
            <div class="mini-stat-label">堆使用率</div>
          </div>
        </el-col>
      </el-row>

      <!-- 告警 -->
      <div v-if="extendedStats.alerts.length > 0" class="alerts-section">
        <div v-for="(alert, idx) in extendedStats.alerts" :key="idx" class="alert-item">
          <el-tag :type="alertTagType(alert.level)" size="small" effect="dark">
            {{ alert.level === 'error' ? '严重' : alert.level === 'warning' ? '警告' : '提示' }}
          </el-tag>
          <span class="alert-message">{{ alert.message }}</span>
        </div>
      </div>
      <div v-else class="no-alerts">暂无告警，系统运行正常</div>
    </el-card>

    <!-- 图表区域 -->
    <el-card class="chart-card" shadow="hover">
      <template #header>
        <span class="chart-title">月度发送趋势</span>
      </template>
      <div ref="monthlyChartRef" class="chart-container"></div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { User, Star, Calendar, Message, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { getTodayBirthdayEmployees, getTomorrowBirthdayEmployees, getEmployeeList } from '@/api/employees'
import { getRecordStats, getMonthlyStats, getRecordList, testSend } from '@/api/records'
import { getSystemHealth, getSystemStats, getExtendedStats } from '@/api/monitor'
import type { Employee } from '@/api/employees'
import type { SystemHealth, SystemStats, ExtendedStats } from '@/api/monitor'

// 统计数据
const stats = reactive({
  totalEmployees: 0,
  todayBirthdays: 0,
  tomorrowBirthdays: 0,
  totalSent: 0
})

// 今日生日员工
const todayBirthdays = ref<Employee[]>([])
const sentEmployeeIds = ref<Set<number>>(new Set())
const sendingId = ref<number | null>(null)
const sendProgress = ref(0)

// ECharts 实例
const monthlyChartRef = ref<HTMLElement>()
let monthlyChart: echarts.ECharts | null = null

// 品牌色
const BRAND_COLORS = {
  primary: '#0085CC',
  secondary: '#1B83C6',
  accent: '#95C11F',
  success: '#67C23A',
  warning: '#E6A23C',
  danger: '#F56C6C'
}

// ===== 监控数据 =====
const health = ref<SystemHealth>({
  sender_service: 'unknown',
  monitor_service: 'unknown',
  database: 'unknown',
  last_heartbeat: ''
})

const monitorStats = ref<SystemStats>({
  send_stats: { total: 0, success: 0, failed: 0, success_rate: 0 },
  template_usage: [],
  today_count: 0,
  level_stats: []
})

const extendedStats = ref<ExtendedStats>({
  memory: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0, usagePercent: 0 },
  cron_jobs: {},
  alerts: []
})

const monitorLastRefresh = ref('--')

// 健康状态卡片
const healthCards = computed(() => [
  {
    key: 'sender',
    label: '发送服务',
    value: statusLabel(health.value.sender_service),
    statusClass: statusClass(health.value.sender_service)
  },
  {
    key: 'monitor',
    label: '监控服务',
    value: statusLabel(health.value.monitor_service),
    statusClass: statusClass(health.value.monitor_service)
  },
  {
    key: 'database',
    label: '数据库',
    value: statusLabel(health.value.database),
    statusClass: health.value.database === 'connected' ? 'status-healthy' : 'status-unhealthy'
  },
  {
    key: 'heartbeat',
    label: '最后心跳',
    value: health.value.last_heartbeat ? formatTime(health.value.last_heartbeat) : '暂无',
    statusClass: health.value.last_heartbeat ? 'status-healthy' : 'status-unhealthy'
  }
])

// 监控辅助函数
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    healthy: '正常', unhealthy: '异常',
    connected: '已连接', disconnected: '未连接', unknown: '未知'
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

function alertTagType(level: string): string {
  const map: Record<string, string> = { error: 'danger', warning: 'warning', info: 'info' }
  return map[level] || 'info'
}

// 初始化月度趋势图
const initMonthlyChart = (monthly: { month: string; total: number; success: number; failed: number }[]) => {
  if (!monthlyChartRef.value) return
  monthlyChart = echarts.init(monthlyChartRef.value)

  const months = monthly.map(m => m.month)
  const totalData = monthly.map(m => m.total)
  const successData = monthly.map(m => m.success)

  monthlyChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#eee',
      textStyle: { color: '#333' }
    },
    legend: {
      data: ['总发送', '成功'],
      bottom: 0,
      textStyle: { color: '#666' }
    },
    grid: { top: 10, right: 20, bottom: 36, left: 50 },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { color: '#999', fontSize: 11 },
      axisLine: { lineStyle: { color: '#ddd' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#999' },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [
      {
        name: '总发送',
        type: 'line',
        smooth: true,
        data: totalData,
        itemStyle: { color: BRAND_COLORS.primary },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0,133,204,0.25)' },
            { offset: 1, color: 'rgba(0,133,204,0.02)' }
          ])
        }
      },
      {
        name: '成功',
        type: 'line',
        smooth: true,
        data: successData,
        itemStyle: { color: BRAND_COLORS.accent },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(149,193,31,0.2)' },
            { offset: 1, color: 'rgba(149,193,31,0.02)' }
          ])
        }
      }
    ]
  })
}

// 窗口resize处理
const handleResize = () => {
  monthlyChart?.resize()
}

// 加载数据
const loadData = async () => {
  try {
    const [recordStats, empList, monthlyData] = await Promise.all([
      getRecordStats(),
      getEmployeeList({ page: 1, pageSize: 1 }),
      getMonthlyStats()
    ])

    stats.totalSent = recordStats.total || 0
    stats.totalEmployees = empList.total || 0

    // 获取今日已发送记录
    try {
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`
      const todayRecords = await getRecordList({ page: 1, pageSize: 1000, status: 'success', startDate: todayStr, endDate: tomorrowStr })
      todayRecords.list.forEach((r: any) => {
        if (r.employee_id) sentEmployeeIds.value.add(r.employee_id)
      })
    } catch (e) {
      console.error('[仪表盘] 查询今日发送记录失败:', e)
    }

    // 获取今日 + 明日生日员工
    await Promise.all([refreshBirthdays(), refreshTomorrowBirthdays()])

    // 渲染图表
    await nextTick()
    if (monthlyData.monthly.length > 0) {
      initMonthlyChart(monthlyData.monthly)
    }
  } catch (error) {
    console.error('加载数据失败：', error)
  }
}

// 加载监控数据
const loadMonitorData = async () => {
  try {
    const [healthData, statsData, extendedData] = await Promise.all([
      getSystemHealth(),
      getSystemStats(),
      getExtendedStats()
    ])
    health.value = healthData
    monitorStats.value = statsData
    extendedStats.value = extendedData
    monitorLastRefresh.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch (e) {
    console.error('[仪表盘] 加载监控数据失败:', e)
  }
}

// 刷新生日列表
const refreshBirthdays = async () => {
  try {
    todayBirthdays.value = await getTodayBirthdayEmployees()
    stats.todayBirthdays = todayBirthdays.value.length
  } catch (error) {
    console.error('获取今日生日员工失败：', error)
    todayBirthdays.value = []
    stats.todayBirthdays = 0
  }
}

// 刷新生日列表
const refreshTomorrowBirthdays = async () => {
  try {
    const list = await getTomorrowBirthdayEmployees()
    stats.tomorrowBirthdays = list.length
  } catch (error) {
    console.error('获取明日生日员工失败：', error)
    stats.tomorrowBirthdays = 0
  }
}

// 测试发送
const handleTestSend = async (employeeId: number) => {
  if (sentEmployeeIds.value.has(employeeId)) return
  sendingId.value = employeeId
  sendProgress.value = 0

  const progressTimer = setInterval(() => {
    if (sendProgress.value < 95) {
      sendProgress.value = Math.min(sendProgress.value + Math.floor(Math.random() * 3) + 1, 95)
    }
  }, 3000)

  try {
    const res = await testSend(employeeId)
    clearInterval(progressTimer)
    sendProgress.value = 100
    const isSuccess = res?.smsStatus === 'success'
    if (isSuccess) {
      sentEmployeeIds.value.add(employeeId)
    }
  } catch (error) {
    clearInterval(progressTimer)
    ElMessage.error('测试发送失败')
  } finally {
    setTimeout(() => {
      sendingId.value = null
      sendProgress.value = 0
    }, 800)
  }
}

// 监控自动刷新（3 分钟）
let monitorTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await Promise.all([loadData(), loadMonitorData()])
  monitorTimer = setInterval(loadMonitorData, 180000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  monthlyChart?.dispose()
  if (monitorTimer) {
    clearInterval(monitorTimer)
    monitorTimer = null
  }
})
</script>

<style scoped>
.dashboard-container {
  padding: 0;
  max-width: 1440px;
  margin: 0 auto;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid var(--card-accent);
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--card-accent) 12%, transparent);
  color: var(--card-accent);
  flex-shrink: 0;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* 生日卡片 */
.birthday-card {
  margin-bottom: 24px;
  border-radius: 12px;
}

.birthday-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.birthday-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: var(--bg-color);
  border-radius: 8px;
  transition: all 0.3s;
}

.birthday-item:hover {
  background: color-mix(in srgb, var(--primary-color) 6%, transparent);
  transform: translateX(4px);
}

.employee-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.employee-detail {
  font-size: 13px;
  color: var(--text-secondary);
}

/* 发送操作区域 */
.send-action-area {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.send-progress-bar {
  width: 100px;
  height: 4px;
  background: #e4e7ed;
  border-radius: 2px;
  overflow: hidden;
}

.send-progress-fill {
  height: 100%;
  background: var(--accent-color);
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* 监控面板 */
.monitor-card {
  margin-bottom: 24px;
  border-radius: 12px;
}

.monitor-section {
  margin-bottom: 16px;
}

.monitor-section:last-child {
  margin-bottom: 0;
}

.health-mini-card {
  padding: 12px 16px;
  background: var(--bg-color);
  border-radius: 8px;
  margin-bottom: 8px;
}

.health-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.status-dot.status-healthy {
  background-color: #67C23A;
  box-shadow: 0 0 4px rgba(103, 194, 58, 0.5);
}

.status-dot.status-unhealthy {
  background-color: #F56C6C;
  box-shadow: 0 0 4px rgba(245, 108, 108, 0.5);
}

.status-dot.status-unknown {
  background-color: #909399;
}

.health-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.health-status-text {
  font-size: 15px;
  font-weight: 600;
  padding-left: 16px;
}

.health-status-text.status-healthy {
  color: #67C23A;
}

.health-status-text.status-unhealthy {
  color: #F56C6C;
}

.health-status-text.status-unknown {
  color: #909399;
}

.mini-stat {
  text-align: center;
  padding: 12px;
  background: var(--bg-color);
  border-radius: 8px;
  margin-bottom: 8px;
}

.mini-stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.mini-stat-unit {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  margin-left: 2px;
}

.mini-stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* 告警 */
.alerts-section {
  padding: 12px 16px;
  background: #fdf6ec;
  border-radius: 8px;
  border-left: 3px solid #E6A23C;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(230, 162, 60, 0.15);
}

.alert-item:last-child {
  border-bottom: none;
}

.alert-message {
  font-size: 13px;
  color: #606266;
}

.no-alerts {
  text-align: center;
  color: #67C23A;
  padding: 12px 0;
  font-size: 13px;
}

/* 图表区域 */
.chart-card {
  border-radius: 12px;
  margin-bottom: 24px;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.chart-container {
  width: 100%;
  height: 280px;
}

/* 卡片头部通用 */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .dashboard-container {
    padding: 0;
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .stat-card {
    padding: 14px;
    gap: 12px;
  }

  .stat-icon-wrap {
    width: 42px;
    height: 42px;
  }

  .stat-value {
    font-size: 22px;
  }

  .chart-container {
    height: 240px;
  }

  .birthday-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .birthday-item .el-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
