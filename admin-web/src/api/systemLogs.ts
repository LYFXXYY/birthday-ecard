import request from './request'

export interface SystemLog {
  id: number
  level: 'info' | 'warn' | 'error'
  category: string
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface SystemLogQuery {
  page?: number
  pageSize?: number
  level?: string
  category?: string
  startDate?: string
  endDate?: string
}

export interface SystemLogStats {
  level_stats: { level: string; count: number }[]
  category_stats: { category: string; count: number }[]
  today_count: number
  total_count: number
  recent_errors: number
}

// 获取系统日志列表
export const getSystemLogs = (params?: SystemLogQuery): Promise<{
  list: SystemLog[]
  total: number
  page: number
  pageSize: number
}> => {
  return request.get('/system-logs', { params })
}

// 获取系统日志统计
export const getSystemLogStats = (): Promise<SystemLogStats> => {
  return request.get('/system-logs/stats')
}
