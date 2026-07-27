import request from '../utils/request'
import type {
  ApiResponse,
  Message,
  MessageParams,
  GroupMessageParams,
  PrivateMessageParams,
  Image
} from '../types/api'

export const messageApi = {
  getAllMessages(params?: MessageParams): Promise<ApiResponse<Message[]>> {
    return request.get('/api/message', { params })
  },

  getGroupMessages(params: GroupMessageParams): Promise<ApiResponse<Message[]>> {
    return request.get('/api/message/group', { params })
  },

  getPrivateMessages(params: PrivateMessageParams): Promise<ApiResponse<Message[]>> {
    return request.get('/api/message/private', { params })
  },

  getMessageById(messageId: number): Promise<ApiResponse<Message>> {
    return request.get(`/api/message/${messageId}`)
  },

  getMessageImages(messageId: number): Promise<ApiResponse<Image[]>> {
    return request.get(`/api/message/${messageId}/images`)
  }
}
