import request from '../utils/request'
import type {
  ApiResponse,
  LoginRequest,
  LoginResponse
} from '../types/api'

export const authApi = {
  login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return request.post('/api/auth/login', data)
  }
}
