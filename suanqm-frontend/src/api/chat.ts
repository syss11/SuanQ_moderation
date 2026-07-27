import request from '../utils/request'
import type {
  ApiResponse,
  Group,
  Friend,
  GroupMember
} from '../types/api'

export const chatApi = {
  getGroups(): Promise<ApiResponse<Group[]>> {
    return request.get('/api/chat/groups')
  },

  getFriends(): Promise<ApiResponse<Friend[]>> {
    return request.get('/api/chat/friends')
  },

  getGroupMembers(groupId: number): Promise<ApiResponse<GroupMember[]>> {
    return request.get('/api/chat/group/members', { params: { groupId } })
  }
}
