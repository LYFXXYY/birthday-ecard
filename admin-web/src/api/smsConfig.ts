import request from './request'

/** 配置项定义 */
export interface ConfigItem {
  key: string
  label: string
  description: string
  value: string
  isSecret?: boolean
  configured: boolean
}

/** 配置读取响应 */
export interface SmsConfigData {
  csp: ConfigItem[]
  sms: ConfigItem[]
  envPath: string
}

/**
 * 获取当前短信配置
 */
export const getSmsConfig = (): Promise<SmsConfigData> => {
  return request.get('/admin/sms-config')
}

/**
 * 更新短信配置
 * @param data 键值对 { CSP_APP_ID: 'xxx', ... }
 */
export const updateSmsConfig = (data: Record<string, string>): Promise<{ updated: string[] }> => {
  return request.put('/admin/sms-config', data)
}
