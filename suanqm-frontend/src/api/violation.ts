import request from '../utils/request'
import type {
  ApiResponse,
  PaginatedResponse,
  Violation,
  ViolationParams,
  UpdateViolationStatusRequest
} from '../types/api'

export const violationApi = {
  getAllViolations(params?: ViolationParams): Promise<PaginatedResponse<Violation>> {
    return request.get('/api/violations', { params })
  },

  getViolationById(id: number): Promise<ApiResponse<Violation>> {
    return request.get(`/api/violations/${id}`)
  },

  getUserViolations(userId: number, params?: { page?: number; pageSize?: number; status?: string }): Promise<PaginatedResponse<Violation>> {
    return request.get(`/api/violations/user/${userId}`, { params })
  },

  getViolationsByType(type: string, params?: { page?: number; pageSize?: number }): Promise<PaginatedResponse<Violation>> {
    return request.get(`/api/violations/type/${type}`, { params })
  },

  updateViolationStatus(id: number, data: UpdateViolationStatusRequest): Promise<ApiResponse<null>> {
    return request.patch(`/api/violations/${id}/status`, data)
  },

  deleteViolation(id: number): Promise<ApiResponse<null>> {
    return request.delete(`/api/violations/${id}`)
  }
}
