<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">SuanQm 管理系统</h1>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="请输入密码"
            required
            class="form-input"
          />
        </div>
        <button type="submit" class="login-button" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { WebSocketClient } from '../utils/websocket'

const router = useRouter()
const userStore = useUserStore()

const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await userStore.login({ password: password.value })
    if (response.code === 200) {
      const token = response.data.token
      
      const wsClient = new WebSocketClient(token)
      
      wsClient.setCallbacks({
        onConnected: (authenticated) => {
          if (authenticated) {
            console.log('WebSocket认证成功')
          } else {
            console.error('WebSocket认证失败')
          }
        },
        onAuthSuccess: (data) => {
          console.log('认证成功，用户ID:', data.userId)
        },
        onLogs: (logs) => {
          console.log('收到日志:', logs)
        },
        onError: (data) => {
          console.error('WebSocket错误:', data.message)
        }
      })
      
      wsClient.connect()
      
      userStore.setWebSocketClient(wsClient)
      
      router.push('/')
    } else {
      errorMessage.value = response.message || '登录失败'
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || '登录失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  padding: 20px;
  background: linear-gradient(135deg,purple 25%, $color-purple-gradient-end 70%);
  box-sizing: border-box;
}

.login-card {
  background: $color-bg-secondary;
  padding: 40px;
  border-radius: $radius-lg;
  box-shadow: $shadow-xl;
  width: 100%;
  max-width: 400px;
  box-sizing: border-box;
}

.login-title {
  text-align: center;
  color: $color-text-primary;
  margin-bottom: 30px;
  font-size: 24px;
  font-weight: 600;
}

.login-form {
  .form-group {
    margin-bottom: 20px;

    label {
      display: block;
      margin-bottom: 8px;
      color: $color-text-secondary;
      font-weight: 500;
      font-size: 14px;
    }

    .form-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid $color-border;
      border-radius: $radius-md;
      font-size: 14px;
      transition: all $transition-base;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: $color-secondary;
        box-shadow: 0 0 0 3px rgba(155, 89, 182, 0.1);
      }

      &::placeholder {
        color: $color-text-light;
      }
    }
  }

  .login-button {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, $color-purple-gradient-start 0%, $color-purple-gradient-end 100%);
    color: $color-text-white;
    border: none;
    border-radius: $radius-md;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all $transition-base;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(155, 89, 182, 0.4);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .error-message {
    margin-top: 16px;
    color: $color-danger;
    text-align: center;
    font-size: 14px;
  }
}
</style>
