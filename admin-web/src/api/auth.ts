import request from './request'

// 登录参数
export interface LoginParams {
  username: string
  password: string
}

// 登录响应
export interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    display_name: string
  }
}

// 管理员登录
export const login = (data: LoginParams): Promise<LoginResponse> => {
  return request.post('/auth/login', data)
}

// 获取当前管理员信息
export const getProfile = () => {
  return request.get('/auth/profile')
}

// 修改密码
export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
}

export const changePassword = (data: ChangePasswordParams) => {
  return request.post('/auth/change-password', data)
}