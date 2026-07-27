import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'
import type { LoginRequest } from '../types/api'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const isAuthenticated = computed(() => !!token.value)
  const wsClient = ref<any>(null)

  async function login(data: LoginRequest) {
    const response = await authApi.login(data)
    if (response.code === 200) {
      token.value = response.data.token
      localStorage.setItem('token', response.data.token)
    }
    return response
  }

  function logout() {
    token.value = ''
    localStorage.removeItem('token')
    
    if (wsClient.value?.close) {
      wsClient.value.close()
      wsClient.value = null
    }
  }

  function setWebSocketClient(client: any) {
    wsClient.value = client
  }

  return {
    token,
    isAuthenticated,
    login,
    logout,
    wsClient,
    setWebSocketClient
  }
})
