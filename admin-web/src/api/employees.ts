import request from './request'
import axios from 'axios'
import { useUserStore } from '@/stores/user'

// 员工信息接口
export interface Employee {
  id?: number
  name: string
  gender: 'male' | 'female'
  birthday: string
  phone: string
  department?: string
  position?: string
  default_template_id?: number | null
  is_active?: number
  created_at?: string
  updated_at?: string
}

// 分页查询参数
export interface EmployeeQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  department?: string
  is_active?: number
}

// 分页响应
export interface PageResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 获取员工列表（分页）
export const getEmployeeList = (params: EmployeeQueryParams): Promise<PageResponse<Employee>> => {
  return request.get('/employees', { params })
}

// 获取员工详情
export const getEmployeeDetail = (id: number): Promise<Employee> => {
  return request.get(`/employees/${id}`)
}

// 新增员工
export const createEmployee = (data: Employee): Promise<Employee> => {
  return request.post('/employees', data)
}

// 修改员工信息
export const updateEmployee = (id: number, data: Employee): Promise<Employee> => {
  return request.put(`/employees/${id}`, data)
}

// 删除员工
export const deleteEmployee = (id: number) => {
  return request.delete(`/employees/${id}`)
}

// Excel批量导入（直接调用 axios，绕过响应拦截器以获取详细验证错误）
export const importEmployees = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const userStore = useUserStore()
  const token = userStore.getToken()
  const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'
  
  const response = await axios.post(`${baseURL}/employees/import`, formData, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
      // Content-Type 由浏览器自动设置 multipart/form-data + boundary
    },
    validateStatus: () => true  // 不抛出 HTTP 错误，由调用方处理
  })
  
  return response
}

// 获取今天生日的员工
export const getTodayBirthdayEmployees = (): Promise<Employee[]> => {
  return request.get('/employees/today-birthday')
}

// 生成员工贺卡
export const generateEmployeeCard = (id: number) => {
  return request.post(`/employees/${id}/generate-card`)
}