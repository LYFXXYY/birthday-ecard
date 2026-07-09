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
  must_change_password: boolean
  password_expired: boolean
}

// 管理员登录
export const login = (data: LoginParams): Promise<LoginResponse> => {
  return request.post('/auth/login', data)
}

// 修改密码
export interface ChangePasswordParams {
  oldPassword: string
  newPassword: string
}

export const changePassword = (data: ChangePasswordParams) => {
  return request.post('/auth/change-password', data)
}

// 退出登录
export const logout = () => {
  return request.post('/auth/logout')
}
