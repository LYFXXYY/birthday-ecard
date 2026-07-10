<template>
  <div class="layout-container">
    <!-- 顶部区域：品牌 + 导航 -->
    <header class="top-header">
      <!-- 品牌区：Logo + 项目名 + 用户信息 -->
      <div class="brand-bar">
        <div class="brand-left">
          <span class="logo-wrap">
            <img :src="logoUrl" alt="logo" class="logo" />
          </span>
          <span class="brand-divider"></span>
          <h1 class="brand-title">工会生日贺卡管理系统</h1>
        </div>
        <div class="brand-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="34" style="background-color: var(--accent-color)">
                {{ userInitial }}
              </el-avatar>
              <span class="username">{{ displayName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 导航栏 -->
      <nav class="nav-bar">
        <el-menu
          :default-active="activeMenu"
          mode="horizontal"
          background-color="transparent"
          text-color="rgba(255,255,255,0.75)"
          active-text-color="#ffffff"
          router
          :ellipsis="false"
        >
          <el-menu-item index="/">
            <el-icon><HomeFilled /></el-icon>
            <span>仪表盘</span>
          </el-menu-item>

          <el-sub-menu index="employees" popper-class="nav-dark-sub">
            <template #title>
              <el-icon><User /></el-icon>
              <span>人员管理</span>
            </template>
            <el-menu-item index="/employees">
              <el-icon><List /></el-icon>
              <template #title>人员列表</template>
            </el-menu-item>
            <el-menu-item index="/employees/add">
              <el-icon><Plus /></el-icon>
              <template #title>添加人员</template>
            </el-menu-item>
            <el-menu-item index="/employees/import">
              <el-icon><Upload /></el-icon>
              <template #title>批量导入</template>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/templates">
            <el-icon><Picture /></el-icon>
            <span>模板管理</span>
          </el-menu-item>

          <el-menu-item index="/blessings">
            <el-icon><ChatDotRound /></el-icon>
            <span>祝福语管理</span>
          </el-menu-item>

          <el-menu-item index="/records">
            <el-icon><Document /></el-icon>
            <span>发送记录</span>
          </el-menu-item>

          <el-menu-item index="/operation-logs">
            <el-icon><Notebook /></el-icon>
            <span>操作日志</span>
          </el-menu-item>

          <el-menu-item index="/system-logs">
            <el-icon><Monitor /></el-icon>
            <span>系统日志</span>
          </el-menu-item>

          <el-menu-item index="/system-stats">
            <el-icon><DataAnalysis /></el-icon>
            <span>系统监控</span>
          </el-menu-item>
        </el-menu>
      </nav>
    </header>

    <!-- 修改密码弹窗 -->
    <el-dialog
      title="修改密码"
      :model-value="passwordDialogVisible"
      width="420px"
      @close="resetPasswordForm"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="原密码" prop="oldPassword">
          <el-input v-model="passwordForm.oldPassword" type="password" show-password autocomplete="off" />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password autocomplete="off" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password autocomplete="off" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitChangePassword">提交</el-button>
      </template>
    </el-dialog>

    <!-- 内容区域 -->
    <main class="content">
      <router-view />
    </main>

    <!-- 底部 -->
    <footer class="footer">
      <span>© 信阳移动公司工会</span>
      <span class="footer-divider">|</span>
      <span>豫ICP备xxxx号</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { 
  HomeFilled, 
  User, 
  List, 
  Plus, 
  Upload, 
  Picture, 
  ChatDotRound,
  Document,
  Notebook,
  Monitor,
  DataAnalysis,
  ArrowDown
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { changePassword, logout as logoutApi } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// Logo 地址（动态绑定避免 Vite 静态分析）
const logoUrl = '/uploads/logo.svg'

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 密码修改弹窗
const passwordDialogVisible = ref(false)
const passwordFormRef = ref()
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码长度不能少于6位', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]{6,}$/, message: '需包含字母和数字', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 用户信息
const displayName = computed(() => {
  return userStore.userInfo?.display_name || '管理员'
})

const userInitial = computed(() => {
  const name = displayName.value
  return name.charAt(0).toUpperCase()
})

const resetPasswordForm = () => {
  passwordForm.value.oldPassword = ''
  passwordForm.value.newPassword = ''
  passwordForm.value.confirmPassword = ''
  passwordFormRef.value?.clearValidate()
}

const submitChangePassword = () => {
  passwordFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return

    try {
      await changePassword({
        oldPassword: passwordForm.value.oldPassword,
        newPassword: passwordForm.value.newPassword
      })
      ElMessage.success('密码修改成功，请重新登录')
      passwordDialogVisible.value = false
      resetPasswordForm()
      userStore.clearAuth()
      router.push('/login')
    } catch (err: any) {
      ElMessage.error(err?.message || '密码修改失败，请重试')
    }
  })
}

// 处理下拉菜单命令
const handleCommand = async (command: string) => {
  switch (command) {
    case 'password':
      resetPasswordForm()
      passwordDialogVisible.value = true
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        // 调用后端登出接口，清除会话记录
        try {
          await logoutApi()
        } catch {
          // 即使后端接口失败，也清除本地状态
        }

        userStore.clearAuth()
        ElMessage.success('已退出登录')
        router.push('/login')
      } catch {
        // 用户取消
      }
      break
  }
}

// ========== 会话超时逻辑 ==========

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 分钟
const CHECK_INTERVAL_MS = 60 * 1000       // 每分钟检查一次

let lastActivityTime = Date.now()
let sessionCheckTimer: ReturnType<typeof setInterval> | null = null

const updateActivityTime = () => {
  lastActivityTime = Date.now()
}

const checkSessionTimeout = () => {
  const elapsed = Date.now() - lastActivityTime
  if (elapsed >= SESSION_TIMEOUT_MS) {
    ElMessage.warning('长时间未操作，会话已超时，请重新登录')
    userStore.clearAuth()
    router.push('/login')
  }
}

onMounted(() => {
  window.addEventListener('mousemove', updateActivityTime)
  window.addEventListener('keydown', updateActivityTime)
  window.addEventListener('click', updateActivityTime)

  sessionCheckTimer = setInterval(checkSessionTimeout, CHECK_INTERVAL_MS)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', updateActivityTime)
  window.removeEventListener('keydown', updateActivityTime)
  window.removeEventListener('click', updateActivityTime)

  if (sessionCheckTimer) {
    clearInterval(sessionCheckTimer)
    sessionCheckTimer = null
  }
})
</script>

<style scoped>
.layout-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
}

/* ========== 顶部区域 ========== */
.top-header {
  background-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
  flex-shrink: 0;
}

/* 品牌区 */
.brand-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  height: 72px;
}

.brand-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 8px;
  padding: 6px 10px;
  flex-shrink: 0;
}

.logo {
  height: 42px;
  width: auto;
}

.brand-divider {
  width: 1px;
  height: 28px;
  background: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.brand-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  letter-spacing: 1px;
}

.brand-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 6px;
  transition: background-color 0.3s;
  color: #fff;
}

.user-info:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.username {
  font-size: 14px;
  color: #fff;
}

/* 导航栏 */
.nav-bar {
  background-color: var(--primary-dark);
  padding: 0 24px;
}

/* 覆盖 Element Plus 水平菜单默认底部边框 */
.nav-bar :deep(.el-menu) {
  border-bottom: none !important;
}

.nav-bar :deep(.el-menu-item),
.nav-bar :deep(.el-sub-menu__title) {
  border-bottom: none !important;
  height: 44px;
  line-height: 44px;
  font-size: 14px;
}

/* 悬停状态 */
.nav-bar :deep(.el-menu-item:hover),
.nav-bar :deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* 激活状态：底部绿色指示条 */
.nav-bar :deep(.el-menu-item.is-active) {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-bottom: 3px solid var(--accent-color) !important;
}

/* 子菜单弹出层 */
.nav-bar :deep(.el-sub-menu .el-menu) {
  background-color: var(--primary-dark) !important;
  min-width: 140px;
  padding: 4px 0;
}

.nav-bar :deep(.el-sub-menu .el-menu .el-menu-item) {
  height: 40px;
  line-height: 40px;
  margin: 0 4px;
  border-radius: 4px;
}

.nav-bar :deep(.el-sub-menu .el-menu .el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.nav-bar :deep(.el-sub-menu .el-menu .el-menu-item.is-active) {
  background-color: var(--primary-color) !important;
  border-bottom: none;
}

/* 子菜单弹出层（teleported 到 body，需用 :global 覆盖） */
:global(.nav-dark-sub) {
  background-color: var(--primary-dark) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  padding: 4px 0 !important;
  min-width: 140px !important;
}

:global(.nav-dark-sub .el-menu) {
  background-color: transparent !important;
}

:global(.nav-dark-sub .el-menu-item) {
  color: rgba(255, 255, 255, 0.75) !important;
  height: 40px;
  line-height: 40px;
  margin: 0 4px;
  border-radius: 4px;
}

:global(.nav-dark-sub .el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
}

:global(.nav-dark-sub .el-menu-item.is-active) {
  background-color: var(--primary-color) !important;
  color: #fff !important;
}

/* ========== 内容区域 ========== */
.content {
  flex: 1;
  background-color: var(--bg-color);
  overflow-y: auto;
  padding: var(--content-padding);
}

/* ========== 底部 ========== */
.footer {
  height: var(--footer-height);
  background-color: #f5f7fa;
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.footer-divider {
  color: var(--border-color);
}

/* ========== 移动端适配 ========== */
@media (max-width: 768px) {
  .brand-bar {
    padding: 0 16px;
    height: 60px;
  }

  .logo {
    height: 32px;
  }

  .logo-wrap {
    padding: 4px 6px;
  }

  .brand-title {
    font-size: 15px;
  }

  .brand-divider {
    display: none;
  }

  .username {
    display: none;
  }

  .nav-bar {
    padding: 0 8px;
    overflow-x: auto;
  }

  .content {
    padding: 12px;
  }
}
</style>
