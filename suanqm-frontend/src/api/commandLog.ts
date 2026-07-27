import request from '../utils/request'
import type { ApiResponse, PaginatedResponse } from '../types/api'

export interface CommandLog {
  id: number
  user_id: number
  group_id: number | null
  command: string
  params: string
  is_co_admin: boolean
  ruling_cost: number
  target_user_id: number | null
  auth_level: string
  success: boolean
  error_message: string | null
  reason: string | null
  created_at: string
}

export interface CommandLogFilter {
  page?: number
  pageSize?: number
  groupId?: number
  userId?: number
  command?: string
  isCoAdmin?: boolean
  success?: boolean
}

export interface CommandStats {
  [command: string]: number
}

export interface UserStat {
  user_id: number
  count: number
}

export interface CoAdminStat {
  user_id: number
  total_cost: number
  count: number
}

export interface AddReasonRequest {
  reason: string
}

export const commandLogApi = {
  getCommandLogs(params?: CommandLogFilter): Promise<PaginatedResponse<CommandLog>> {
    return request.get('/api/command-logs', { params })
  },

  getCommandLogById(id: number): Promise<ApiResponse<CommandLog>> {
    return request.get(`/api/command-logs/${id}`)
  },

  getCommandStats(): Promise<ApiResponse<CommandStats>> {
    return request.get('/api/command-logs/stats/by-command')
  },

  getUserStats(params?: { groupId?: number }): Promise<ApiResponse<UserStat[]>> {
    return request.get('/api/command-logs/stats/by-user', { params })
  },

  getCoAdminStats(params?: { groupId?: number }): Promise<ApiResponse<CoAdminStat[]>> {
    return request.get('/api/command-logs/stats/co-admin', { params })
  },

  getCoAdminLogs(params?: { page?: number; pageSize?: number; groupId?: number }): Promise<PaginatedResponse<CommandLog>> {
    return request.get('/api/command-logs/co-admin', { params })
  },

  getFailedLogs(params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<CommandLog>> {
    return request.get('/api/command-logs/failed', { params })
  },

  addReason(id: number, data: AddReasonRequest): Promise<ApiResponse<CommandLog>> {
    return request.post(`/api/command-logs/${id}/reason`, data)
  },

  deleteOldLogs(params?: { days?: number }): Promise<ApiResponse<null>> {
    return request.delete('/api/command-logs/old', { params })
  }
}
