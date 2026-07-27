export interface WebSocketMessage {
  type: string
  data?: any
  timestamp?: number
}

export interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'LOG'
  message: string
  timestamp: string
  prefix?: string
}

export interface WebSocketCallbacks {
  onConnected?: (authenticated: boolean) => void
  onAuthSuccess?: (data: any) => void
  onAuthFailed?: (data: any) => void
  onLogs?: (logs: LogEntry[]) => void
  onPong?: () => void
  onError?: (data: any) => void
  onMessage?: (message: WebSocketMessage) => void
  onClose?: () => void
}

export class WebSocketClient {
  public ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private heartbeatInterval: number | null = null
  public callbacks: WebSocketCallbacks = {}
  private token: string

  constructor(token: string) {
    this.token = token
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    const wsUrl = `${import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:6065'}/ws?token=${this.token}`
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('WebSocket连接已建立')
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        this.handleMessage(message)
      } catch (error) {
        console.error('解析WebSocket消息失败:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error)
      this.callbacks.onError?.(error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket连接已关闭')
      this.stopHeartbeat()
      this.callbacks.onClose?.()
      this.attemptReconnect()
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'connected':
        this.callbacks.onConnected?.(message.data.authenticated || false)
        break

      case 'auth_success':
        this.callbacks.onAuthSuccess?.(message.data)
        break

      case 'auth_failed':
        this.callbacks.onAuthFailed?.(message.data)
        break

      case 'logs':
        this.callbacks.onLogs?.(message.data as LogEntry[])
        break

      case 'pong':
        this.callbacks.onPong?.()
        break

      case 'error':
        this.callbacks.onError?.(message.data)
        break

      default:
        this.callbacks.onMessage?.(message)
        break
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatInterval = window.setInterval(() => {
      this.send('ping')
    }, 30000)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
      setTimeout(() => this.connect(), this.reconnectDelay)
    }
  }

  send(type: string, data?: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  sendAuth(token: string): void {
    this.send('auth', { token })
  }

  close(): void {
    this.stopHeartbeat()
    this.reconnectAttempts = this.maxReconnectAttempts
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = callbacks
  }

  getCallbacks(): WebSocketCallbacks {
    return this.callbacks
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
