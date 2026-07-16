import request from './request'

export interface SystemHealth {
  sender_service: string
  monitor_service: string
  database: string
  last_heartbeat: string
}

export interface SystemStats {
  send_stats: { total: number; success: number; failed: number; success_rate: number }
  template_usage: { template_name: string; count: number }[]
  today_count: number
  level_stats: { level: string; count: number }[]
}

export interface MemoryUsage {
  rss: number
  heapUsed: number
  heapTotal: number
  external: number
  usagePercent: number
}

export interface CronJob {
  name: string
  schedule: string
  last_run: string | null
  status: 'waiting' | 'running' | 'success' | 'warning' | 'error'
  message: string
}

export interface Alert {
  level: 'info' | 'warning' | 'error'
  type: string
  message: string
  created_at: string
}

export interface ExtendedStats {
  memory: MemoryUsage
  cron_jobs: Record<string, CronJob>
  alerts: Alert[]
}

export const getSystemHealth = (): Promise<SystemHealth> => request.get('/monitor/status')
export const getSystemStats = (): Promise<SystemStats> => request.get('/monitor/stats')
export const getExtendedStats = (): Promise<ExtendedStats> => request.get('/monitor/extended')
