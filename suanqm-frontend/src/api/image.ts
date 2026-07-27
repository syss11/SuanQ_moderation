import request from '../utils/request'
import type {
  ApiResponse,
  PaginatedResponse,
  BannedImage,
  BannedImageParams
} from '../types/api'

export const imageApi = {
  getBannedImages(params?: BannedImageParams): Promise<PaginatedResponse<BannedImage>> {
    return request.get('/api/images/banned', { params })
  },

  getUnbannedImages(params?: BannedImageParams): Promise<PaginatedResponse<BannedImage>> {
    return request.get('/api/images/unbanned', { params })
  },

  getImageById(imageId: number): Promise<ApiResponse<BannedImage>> {
    return request.get(`/api/images/${imageId}`)
  },

  deleteImage(imageId: number): Promise<ApiResponse<null>> {
    return request.delete(`/api/images/${imageId}`)
  },

  unbanImage(imageId: number): Promise<ApiResponse<BannedImage>> {
    return request.patch(`/api/images/${imageId}/unban`)
  },

  banImage(imageId: number, reason: string): Promise<ApiResponse<BannedImage>> {
    return request.patch(`/api/images/${imageId}/ban`, { reason })
  }
}
