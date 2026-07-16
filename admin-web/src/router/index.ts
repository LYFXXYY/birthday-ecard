import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresGuest: true } // 未登录才能访问
  },
  {
    path: '/',
    component: () => import('@/components/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'employees',
        name: 'Employees',
        component: () => import('@/views/EmployeeList.vue')
      },
      {
        path: 'employees/add',
        name: 'EmployeeAdd',
        component: () => import('@/views/EmployeeForm.vue')
      },
      {
        path: 'employees/:id/edit',
        name: 'EmployeeEdit',
        component: () => import('@/views/EmployeeForm.vue'),
        props: true
      },
      {
        path: 'employees/import',
        name: 'EmployeeImport',
        component: () => import('@/views/EmployeeImport.vue')
      },
      {
        path: 'templates',
        name: 'Templates',
        component: () => import('@/views/TemplateList.vue')
      },
      {
        path: 'templates/add',
        name: 'TemplateAdd',
        component: () => import('@/views/TemplateEdit.vue')
      },
      {
        path: 'templates/:id/edit',
        name: 'TemplateEdit',
        component: () => import('@/views/TemplateEdit.vue'),
        props: true
      },
      {
        path: 'blessings',
        name: 'Blessings',
        component: () => import('@/views/BlessingList.vue')
      },
      {
        path: 'blessings/add',
        name: 'BlessingAdd',
        component: () => import('@/views/BlessingEdit.vue')
      },
      {
        path: 'blessings/:id/edit',
        name: 'BlessingEdit',
        component: () => import('@/views/BlessingEdit.vue'),
        props: true
      },
      {
        path: 'records',
        name: 'SendRecords',
        component: () => import('@/views/SendRecords.vue')
      },
      {
        path: 'operation-logs',
        name: 'OperationLogs',
        component: () => import('@/views/OperationLogs.vue')
      },
      {
        path: 'system-logs',
        name: 'SystemLogs',
        component: () => import('@/views/SystemLogs.vue')
      },
      {
        path: 'sms-config',
        name: 'SmsConfig',
        component: () => import('@/views/SmsConfig.vue')
      }
    ]
  },
  // 404 页面
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 解析 JWT 判断是否已过期
function isTokenExpired(token: string): boolean {
  try {
    // JWT 使用 base64url 编码（- 和 _ 字符，无 padding），atob() 只认标准 base64
    // 需要先将 base64url 转换为标准 base64 再解码
    let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    // 补齐 padding（base64 长度必须是 4 的倍数）
    while (base64.length % 4) base64 += '='
    const payload = JSON.parse(atob(base64))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

// 全局路由守卫
router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  const token = userStore.getToken()
  console.log('[路由守卫] to:', to.path, 'token:', token ? token.substring(0, 20) + '...' : 'null')

  // 有 token 但已过期 → 清除并跳转登录
  if (token && isTokenExpired(token)) {
    console.log('[路由守卫] token已过期，清除并跳转登录')
    userStore.clearAuth()
    next('/login')
    return
  }

  // 需要登录的页面
  if (to.meta.requiresAuth && !token) {
    console.log('[路由守卫] 需要认证但无token，跳转登录')
    next('/login')
  } 
  // 未登录状态才能访问的页面（如登录页）
  else if (to.meta.requiresGuest && token) {
    console.log('[路由守卫] 已有token，从登录页跳转到首页')
    next('/')
  } 
  // 其他情况正常跳转
  else {
    console.log('[路由守卫] 放行')
    next()
  }
})

export default router
