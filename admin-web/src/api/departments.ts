import request from './request'

// 部门接口
export interface Department {
  id?: number
  name: string
  code: string
  level?: number
  parent_id?: number | null
  sort_order?: number
  description?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
  children?: Department[]
}

// 获取部门树形结构
export const getDepartmentTree = (isActive?: boolean): Promise<Department[]> => {
  const params: Record<string, string> = {}
  if (isActive !== undefined) {
    params.is_active = isActive ? '1' : '0'
  }
  return request.get('/departments/tree', { params })
}

// 新增部门
export const createDepartment = (data: Partial<Department>): Promise<Department> => {
  return request.post('/departments', data)
}

// 修改部门
export const updateDepartment = (id: number, data: Partial<Department>): Promise<void> => {
  return request.put(`/departments/${id}`, data)
}

// 删除部门
export const deleteDepartment = (id: number): Promise<void> => {
  return request.delete(`/departments/${id}`)
}
