import request from '../utils/request'
import type { ApiResponse } from '../types/api'

export interface LogFilter {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'LOG'
  startTime?: string
  endTime?: string
  keyword?: string
  limit?: number
  offset?: number
}

export interface LogEntry {
  id: number
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'LOG'
  message: string
  timestamp: string
  prefix?: string
}

export const logsApi = {
  getLogs(params?: LogFilter): Promise<ApiResponse<LogEntry[]>> {
    return request.get('/api/logs', { params })
  },

  getLogsByLevel(level: string, params?: Omit<LogFilter, 'level'>): Promise<ApiResponse<LogEntry[]>> {
    return request.get(`/api/logs/level/${level}`, { params })
  },

  searchLogs(keyword: string, params?: Omit<LogFilter, 'keyword'>): Promise<ApiResponse<LogEntry[]>> {
    return request.get('/api/logs/search', { params: { keyword, ...params } })
  },

  exportLogs(params?: LogFilter): Promise<Blob> {
    return request.get('/api/logs/export', { 
      params,
      responseType: 'blob'
    })
  }
}
