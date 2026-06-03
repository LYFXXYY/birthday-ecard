<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <aside :class="['sidebar', { collapsed: isCollapsed }]">
      <div class="sidebar-header">
        <h1 v-show="!isCollapsed">生日贺卡管理</h1>
        <h1 v-show="isCollapsed">🎂</h1>
      </div>

      <nav class="sidebar-menu">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapsed"
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
          router
        >
          <el-menu-item index="/">
            <el-icon><HomeFilled /></el-icon>
            <template #title>仪表盘</template>
          </el-menu-item>

          <el-sub-menu index="employees">
            <template #title>
              <el-icon><User /></el-icon>
              <span>员工管理</span>
            </template>
            <el-menu-item index="/employees">
              <el-icon><List /></el-icon>
              <template #title>员工列表</template>
            </el-menu-item>
            <el-menu-item index="/employees/add">
              <el-icon><Plus /></el-icon>
              <template #title>添加员工</template>
            </el-menu-item>
            <el-menu-item index="/employees/import">
              <el-icon><Upload /></el-icon>
              <template #title>批量导入</template>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/templates">
            <el-icon><Picture /></el-icon>
            <template #title>模板管理</template>
          </el-menu-item>

          <el-menu-item index="/blessings">
            <el-icon><ChatDotRound /></el-icon>
            <template #title>祝福语管理</template>
          </el-menu-item>

          <el-menu-item index="/records">
            <el-icon><Document /></el-icon>
            <template #title>发送记录</template>
          </el-menu-item>
        </el-menu>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <div class="main-container">
      <!-- 顶部导航栏 -->
      <header class="header">
        <div class="header-left">
          <el-button 
            :icon="isCollapsed ? Expand : Fold" 
            circle 
            @click="toggleSidebar"
            class="collapse-btn"
          />
        </div>

        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <div class="user-info">
              <el-avatar :size="32" style="background-color: #409EFF">
                {{ userInitial }}
              </el-avatar>
              <span class="username">{{ displayName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人信息</el-dropdown-item>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 内容区域 -->
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
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
  Fold,
  Expand,
  ArrowDown
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// 侧边栏折叠状态
const isCollapsed = ref(false)

// 当前激活的菜单
const activeMenu = computed(() => route.path)

// 用户信息
const displayName = computed(() => {
  return userStore.userInfo?.display_name || '管理员'
})

const userInitial = computed(() => {
  const name = displayName.value
  return name.charAt(0).toUpperCase()
})

// 切换侧边栏
const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}

// 处理下拉菜单命令
const handleCommand = async (command: string) => {
  switch (command) {
    case 'profile':
      ElMessage.info('个人信息功能开发中')
      break
    case 'password':
      ElMessage.info('修改密码功能开发中')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        
        userStore.clearAuth()
        ElMessage.success('已退出登录')
        router.push('/login')
      } catch {
        // 用户取消
      }
      break
  }
}
</script>

<style scoped>
.layout-container {
  display: flex;
  height: 100vh;
  width: 100%;
}

/* 侧边栏样式 */
.sidebar {
  width: 240px;
  background-color: #304156;
  transition: width 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #263445;
  padding: 0 16px;
}

.sidebar-header h1 {
  margin: 0;
  font-size: 18px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
}

.sidebar-menu .el-menu {
  border-right: none;
}

/* 主内容区 */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 顶部导航栏 */
.header {
  height: 60px;
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
}

.collapse-btn {
  border: none;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.user-info:hover {
  background-color: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #303133;
}

/* 内容区域 */
.content {
  flex: 1;
  background-color: #f0f2f5;
  overflow-y: auto;
  padding: 20px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 1000;
    transform: translateX(0);
  }

  .sidebar.collapsed {
    transform: translateX(-100%);
    width: 240px;
  }

  .header {
    padding: 0 12px;
  }

  .username {
    display: none;
  }

  .content {
    padding: 12px;
  }
}

/* 滚动条样式 */
.sidebar-menu::-webkit-scrollbar {
  width: 6px;
}

.sidebar-menu::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.sidebar-menu::-webkit-scrollbar-track {
  background-color: transparent;
}
</style>