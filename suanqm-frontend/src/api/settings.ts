import request from '../utils/request'
import type { ApiResponse } from '../types/api'

export interface ConfigResponse {
  content: string
}

export interface SaveConfigRequest {
  content: string
}

export const settingsApi = {
  getConfig(): Promise<ApiResponse<ConfigResponse>> {
    return request.get('/api/settings/config')
  },

  saveConfig(data: SaveConfigRequest): Promise<ApiResponse<null>> {
    return request.post('/api/settings/config', data)
  }
}
