<template>
  <div class="layout">
    <button @click="toggleSidebar" class="mobile-menu-btn">
      <span class="hamburger-icon">☰</span>
    </button>
    
    <aside class="sidebar" :class="{ collapsed: isCollapsed, mobile: isMobile }">
      <div class="sidebar-header">
        <h1 class="app-title" :class="{ 'title-hidden': isCollapsed }">SuanQm</h1>
        <button @click="toggleSidebar" class="toggle-btn">
          <span class="toggle-icon">{{ isCollapsed ? '▶' : '◀' }}</span>
        </button>
      </div>
      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" @click="handleNavClick">
          <span class="nav-icon">🏠</span>
          <span class="nav-text" :class="{ 'text-hidden': isCollapsed }">首页</span>
        </router-link>
        <router-link to="/about" class="nav-item" @click="handleNavClick">
          <span class="nav-icon">ℹ️</span>
          <span class="nav-text" :class="{ 'text-hidden': isCollapsed }">关于</span>
        </router-link>
        <router-link to="/logs" class="nav-item" @click="handleNavClick">
          <span class="nav-icon">📋</span>
          <span class="nav-text" :class="{ 'text-hidden': isCollapsed }">日志</span>
        </router-link>
        <router-link to="/images" class="nav-item" @click="handleNavClick">
          <span class="nav-icon">🖼️</span>
          <span class="nav-text" :class="{ 'text-hidden': isCollapsed }">图片管理</span>
        </router-link>
        <router-link to="/violations" class="nav-item" @click="handleNavClick">
          <span class="nav-icon">⚠️</span>
          <span class="nav-text" :class="{ 'text-hidden': isCollapsed }">违规记录</span>
        </router-link>
        <router-link to="/command-logs" class="nav-item" @click="handleNavClick">
          <span class="nav-icon">🔧</span>
          <span class="nav-text" :class="{ 'text-hidden': isCollapsed }">命令日志</span>
        </router-link>
        <router-link to="/settings" class="nav-item" @click="handleNavClick">
          <span class="nav-icon">⚙️</span>
          <span class="nav-text" :class="{ 'text-hidden': isCollapsed }">配置</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button @click="handleLogout" class="logout-btn">
          <span class="logout-icon">🚪</span>
          <span :class="{ 'text-hidden': isCollapsed }">登出</span>
        </button>
      </div>
    </aside>
    
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/user'
import router from '../router'

const userStore = useUserStore()
const isCollapsed = ref(false)
const isMobile = ref(false)

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (isMobile.value) {
    isCollapsed.value = true
  }
}

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function handleNavClick() {
  if (isMobile.value) {
    isCollapsed.value = true
  }
}

function handleLogout() {
  userStore.logout()
  router.push('/login')
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.layout {
  display: flex;
  min-height: 100vh;
  position: relative;
}

.mobile-menu-btn {
  display: none;
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1001;
  background: $color-secondary;
  color: $color-text-white;
  border: none;
  border-radius: $radius-md;
  padding: 10px 14px;
  cursor: pointer;
  box-shadow: $shadow-md;
  transition: all $transition-base;

  &:hover {
    background: $color-purple-dark;
  }

  .hamburger-icon {
    font-size: 24px;
  }
}

.sidebar {
  width: 240px;
  background: linear-gradient(180deg, $color-purple-gradient-start 0%, $color-purple-gradient-end 100%);
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-shadow: $shadow-md;
  transition: width $transition-base;
  position: relative;
  z-index: 1000;

  &.collapsed {
    width: 70px;

    .sidebar-header {
      .app-title {
        opacity: 0;
        visibility: hidden;
      }

      .toggle-btn {
        .toggle-icon {
          transform: rotate(180deg);
        }
      }
    }

    .sidebar-nav {
      .nav-item {
        justify-content: center;

        .nav-icon {
          margin-right: 0;
        }

        .nav-text {
          opacity: 0;
          visibility: hidden;
          position: absolute;
        }
      }
    }

    .sidebar-footer {
      .logout-btn {
        justify-content: center;

        .logout-icon {
          margin-right: 0;
        }

        span:not(.logout-icon) {
          opacity: 0;
          visibility: hidden;
          position: absolute;
        }
      }
    }
  }

  &.mobile {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform $transition-base;

    &.collapsed {
      transform: translateX(0);
    }
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;

    .app-title {
      color: $color-text-white;
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 2px;
      transition: opacity $transition-base;
      white-space: nowrap;
      overflow: hidden;
    }

    .toggle-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: $radius-sm;
      padding: 6px 10px;
      cursor: pointer;
      color: $color-text-white;
      transition: all $transition-base;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .toggle-icon {
        font-size: 14px;
        transition: transform $transition-base;
      }
    }
  }

  .sidebar-nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .nav-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        color: rgba(255, 255, 255, 0.8);
        text-decoration: none;
        border-radius: $radius-md;
        transition: all $transition-base;
        white-space: nowrap;
        overflow: hidden;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: $color-text-white;
        }

        &.router-link-active {
          background: rgba(255, 255, 255, 0.2);
          color: $color-text-white;
          font-weight: 600;
        }

        .nav-icon {
          font-size: 20px;
          margin-right: 12px;
          flex-shrink: 0;
          transition: margin-right $transition-base;
        }

        .nav-text {
          font-size: 15px;
          transition: opacity $transition-base, visibility $transition-base;
        }
      }

      &.collapsed {
        .nav-item {
          justify-content: center;
          padding: 12px;

          .nav-icon {
            margin-right: 0;
          }

          .nav-text {
            opacity: 0;
            visibility: hidden;
            position: absolute;
          }
        }
      }
    }

  .sidebar-footer {
    margin-top: auto;

    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.1);
      color: $color-text-white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: $radius-md;
      cursor: pointer;
      transition: all $transition-base;
      font-size: 15px;
      white-space: nowrap;
      overflow: hidden;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.5);
      }

      .logout-icon {
        font-size: 18px;
        flex-shrink: 0;
        transition: margin-right $transition-base;
      }
    }
  }
}

.main-content {
  flex: 1;
  padding: 30px;
  background-color: $color-bg-primary;
  overflow-y: auto;
  transition: margin-left $transition-base;
}

@media (max-width: 768px) {
  .mobile-menu-btn {
    display: block;
  }

  .main-content {
    padding: 20px 20px 20px 80px;
  }

  .sidebar {
    &.collapsed {
      width: 240px;
    }

    &.mobile {
      width: 240px;
    }
  }
}

@media (max-width: 480px) {
  .mobile-menu-btn {
    top: 10px;
    left: 10px;
    padding: 8px 12px;

    .hamburger-icon {
      font-size: 20px;
    }
  }

  .main-content {
    padding: 15px 15px 15px 60px;
  }

  .sidebar {
    &.mobile {
      width: 200px;
      padding: 15px;

      .sidebar-header {
        margin-bottom: 30px;

        .app-title {
          font-size: 24px;
        }
      }

      .sidebar-nav {
        gap: 6px;

        .nav-item {
          padding: 10px 14px;

          .nav-icon {
            font-size: 18px;
            margin-right: 10px;
          }

          .nav-text {
            font-size: 14px;
          }
        }
      }

      .sidebar-footer {
        .logout-btn {
          padding: 10px 14px;
          font-size: 14px;

          .logout-icon {
            font-size: 16px;
          }
        }
      }
    }
  }
}
</style>
