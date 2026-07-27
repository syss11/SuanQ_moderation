import request from '../utils/request'
import type {
  ApiResponse,
  MessageTrendItem,
  UserRankingItem,
  HourlyDistributionItem,
  GroupInfo
} from '../types/api'

export const statisticsApi = {
  getMessageTrend(period: 'day' | 'week' | 'month', count: number, groupId?: number): Promise<ApiResponse<MessageTrendItem[]>> {
    const params: Record<string, any> = { period, count }
    if (groupId) {
      params.groupId = groupId
    }
    return request.get('/api/statistics/message-trend', { params })
  },

  getUserRanking(limit?: number, groupId?: number): Promise<ApiResponse<UserRankingItem[]>> {
    const params: Record<string, any> = {}
    if (limit) {
      params.limit = limit
    }
    if (groupId) {
      params.groupId = groupId
    }
    return request.get('/api/statistics/user-ranking', { params })
  },

  getHourlyDistribution(groupId?: number): Promise<ApiResponse<HourlyDistributionItem[]>> {
    const params: Record<string, any> = {}
    if (groupId) {
      params.groupId = groupId
    }
    return request.get('/api/statistics/hourly-distribution', { params })
  },

  getGroups(): Promise<ApiResponse<GroupInfo[]>> {
    return request.get('/api/statistics/groups')
  }
}