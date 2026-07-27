import { ref, onUnmounted } from 'vue'
import { WebSocketClient } from '../utils/websocket'

let wsInstance: WebSocketClient | null = null

export function useWebSocket() {
  const wsClient = ref<WebSocketClient | null>(null)

  function connect(token: string) {
    if (wsInstance) {
      wsInstance.close()
    }

    wsInstance = new WebSocketClient(token)
    wsInstance.connect()
    wsClient.value = wsInstance
  }

  function disconnect() {
    if (wsInstance) {
      wsInstance.close()
      wsInstance = null
      wsClient.value = null
    }
  }

  function getCallbacks() {
    return wsInstance?.callbacks || {}
  }

  function setCallbacks(callbacks: any) {
    if (wsInstance) {
      wsInstance.setCallbacks(callbacks)
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    wsClient,
    connect,
    disconnect,
    getCallbacks,
    setCallbacks
  }
}
