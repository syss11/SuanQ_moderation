import request from '../utils/request'
import type {
  ApiResponse,
  SystemInfo,
  SelfInfo,
  WebsocketStatus
} from '../types/api'

export const systemApi = {
  getSelfId(): Promise<ApiResponse<SelfInfo>> {
    return request.get('/api/system/self-id')
  },

  getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
    return request.get('/api/system/info')
  },

  getWebsocketStatus(): Promise<ApiResponse<WebsocketStatus>> {
    return request.get('/api/system/websocket-status')
  },

  shutdown(): Promise<ApiResponse<null>> {
    return request.post('/api/system/shutdown')
  }
}
