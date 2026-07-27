export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: Pagination
}

export interface LoginRequest {
  password: string
}

export interface LoginResponse {
  token: string
  expiresIn: number
}

export type MessageType = 'group' | 'private'

export interface Message {
  id: number
  message_type: MessageType
  user_id: number
  group_id?: number
  target_id?: number
  raw_message: string
  timestamp: number
}

export interface MessageParams {
  messageType?: MessageType
  user_id?: number
  group_id?: number
  target_id?: number
  limit?: number
  offset?: number
  start_time?: number
  end_time?: number
}

export interface GroupMessageParams {
  groupId: number
  user_id?: number
  limit?: number
  offset?: number
  start_time?: number
  end_time?: number
}

export interface PrivateMessageParams {
  userId: number
  target_id?: number
  limit?: number
  offset?: number
  start_time?: number
  end_time?: number
}

export interface Image {
  id: number
  filename: string
  path: string
  size: number
  message_id: number
  image_url: string
  md5: string
  phash: number
  banned: boolean
}

export interface LastMessage {
  id: number
  message_type: MessageType
  raw_message: string
  timestamp: number
}

export interface ChatExtra {
  last_message: LastMessage
  unread_count: number
}

export interface Group {
  group_id: number
  group_name: string
  group_remark: string
  avatar_url: string
  chat_extra: ChatExtra
}

export interface Friend {
  user_id: number
  nickname: string
  remark: string
  avatar_url: string
  chat_extra: ChatExtra
}

export interface GroupMember {
  user_id: number
  nickname: string
  card: string
  sex: 'male' | 'female' | 'unknown'
  avatar_url: string
}

export interface SystemInfo {
  system: {
    platform: string
    arch: string
    hostname: string
    type: string
    release: string
  }
  cpu: {
    loadAverage: number[]
  }
  memory: {
    total: number
    free: number
    used: number
    usagePercent: string
    totalGB: string
    freeGB: string
    usedGB: string
  }
  time: {
    currentTime: string
    timezone: string
  }
  websocket: {
    connected: number
    authenticated: number
    status: string
  }
}

export interface SelfInfo {
  self_id: number
  nickname: string
  avatar_url: string
}

export interface WebsocketStatus {
  connected: number
  authenticated: number
  status: string
  endpoint: string
}

export type ViolationType = 'flood' | 'advertising' | 'political_or_rumor' | 'violence_or_sexual' | 'illegal_software' | 'insult_or_attack' | 'doxxing_or_threatening' | 'other'

export type ViolationStatus = 'active' | 'deleted' | 'pending'

export type PenaltyType = 'mute' | 'kick' | 'ban' | 'warning' | 'none'

export interface Violation {
  id: number
  user_id: number
  time: number
  violation_type: ViolationType
  severity: number
  credit_change: number
  penalty_type: PenaltyType
  penalty_time: number
  status: ViolationStatus
  description: string
  created_at: string
}

export interface ViolationParams {
  page?: number
  pageSize?: number
  status?: ViolationStatus
  violation_type?: ViolationType
}

export interface UpdateViolationStatusRequest {
  status: ViolationStatus
}

export interface BannedImage {
  id: number
  url: string
  reason: string
  banned: boolean
  md5: string
  size: number
}

export interface BannedImageParams {
  page?: number
  pageSize?: number
}

export interface ConfigResponse {
  content: string
}

export interface SaveConfigRequest {
  content: string
}

export interface ConfigValidationError {
  error: string
  errors?: string[]
  warnings?: string[]
}

export interface MessageTrendItem {
  date: string
  count: number
}

export interface UserRankingItem {
  user_id: number
  nickname: string
  count: number
}

export interface HourlyDistributionItem {
  hour: number
  count: number
}

export interface GroupInfo {
  group_id: number
  name: string
  member_count: number
}
