import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface UserInfo {
  id: number
  username: string
  display_name: string
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  const token = ref<string>('')

  // 设置token
  const setToken = (tk: string) => {
    token.value = tk
    localStorage.setItem('token', tk)
  }

  // 设置用户信息
  const setUserInfo = (info: UserInfo) => {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }

  // 获取token（优先从内存获取，其次从localStorage）
  const getToken = (): string => {
    if (!token.value) {
      token.value = localStorage.getItem('token') || ''
    }
    return token.value
  }

  // 清除认证信息
  const clearAuth = () => {
    userInfo.value = null
    token.value = ''
    localStorage.removeItem('token')
    localStorage.removeItem('userInfo')
  }

  // 初始化时从localStorage恢复token和用户信息
  const initAuth = () => {
    const savedToken = localStorage.getItem('token')
    if (savedToken) {
      token.value = savedToken
    }

    const savedUser = localStorage.getItem('userInfo')
    if (savedUser) {
      try {
        userInfo.value = JSON.parse(savedUser)
      } catch (error) {
        console.error('解析用户信息失败', error)
      }
    }
  }

  // 初始化
  initAuth()

  return {
    userInfo,
    token,
    setUserInfo,
    setToken,
    getToken,
    clearAuth
  }
})
