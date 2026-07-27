<template>
  <div class="command-log-management">
    <div class="management-header">
      <h1>命令日志管理</h1>
      <div class="actions">
        <div class="filter-group">
          <select v-model="activeTab" @change="handleTabChange" class="filter-select">
            <option value="all">全部日志</option>
            <option value="co-admin">协管日志</option>
            <option value="failed">失败日志</option>
          </select>
          <select v-model="commandFilter" @change="handleFilterChange" class="filter-select">
            <option value="">全部命令</option>
            <option value="ban">封禁</option>
            <option value="unban">解禁</option>
            <option value="mute">禁言</option>
            <option value="unmute">解禁言</option>
            <option value="kick">踢出</option>
            <option value="recall">撤回</option>
            <option value="verify">验证</option>
            <option value="credit">积分</option>
          </select>
          <select v-model="successFilter" @change="handleFilterChange" class="filter-select">
            <option value="">全部状态</option>
            <option value="true">成功</option>
            <option value="false">失败</option>
          </select>
        </div>
        <button @click="loadLogs" class="refresh-btn" :disabled="loading">
          🔄 刷新
        </button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <div class="stat-value">{{ commandStatsTotal }}</div>
          <div class="stat-label">命令总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-info">
          <div class="stat-value">{{ userStatsTotal }}</div>
          <div class="stat-label">活跃用户</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚖️</div>
        <div class="stat-info">
          <div class="stat-value">{{ coAdminCostTotal }}</div>
          <div class="stat-label">协管裁决消耗</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="loading-icon">⏳</span>
      <span class="loading-text">加载中...</span>
    </div>

    <div v-else-if="loadError" class="error-state">
      <span class="error-icon">❌</span>
      <span class="error-text">{{ loadError }}</span>
    </div>

    <div v-else-if="logs.length === 0" class="empty-state">
      <span class="empty-icon">📋</span>
      <span class="empty-text">暂无命令日志</span>
    </div>

    <div v-else class="content">
      <div class="logs-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>命令</th>
              <th>执行者</th>
              <th>目标用户</th>
              <th>群组</th>
              <th>权限</th>
              <th>协管</th>
              <th>消耗</th>
              <th>状态</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" class="table-row">
              <td class="cell-id">#{{ log.id }}</td>
              <td class="cell-command" :class="getCommandClass(log.command)">
                {{ getCommandText(log.command) }}
              </td>
              <td class="cell-user">{{ log.user_id }}</td>
              <td class="cell-user">{{ log.target_user_id || '-' }}</td>
              <td class="cell-group">{{ log.group_id || '私聊' }}</td>
              <td class="cell-auth" :class="getAuthClass(log.auth_level)">
                {{ getAuthText(log.auth_level) }}
              </td>
              <td class="cell-co-admin">
                <span v-if="log.is_co_admin" class="badge-co-admin">是</span>
                <span v-else class="badge-normal">否</span>
              </td>
              <td class="cell-cost">{{ log.ruling_cost }}</td>
              <td class="cell-status">
                <span v-if="log.success" class="badge-success">成功</span>
                <span v-else class="badge-failed">失败</span>
              </td>
              <td class="cell-time">{{ formatTime(log.created_at) }}</td>
              <td class="cell-actions">
                <button @click="viewDetail(log)" class="action-btn view-btn">📄</button>
                <button v-if="!log.reason" @click="addReason(log)" class="action-btn reason-btn">✏️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button
          @click="prevPage"
          class="pagination-btn"
          :disabled="currentPage === 1 || loading"
        >
          ◀ 上一页
        </button>
        <span class="pagination-info">
          第 {{ currentPage }} / {{ totalPages }} 页
        </span>
        <button
          @click="nextPage"
          class="pagination-btn"
          :disabled="currentPage === totalPages || loading"
        >
          下一页 ▶
        </button>
      </div>

      <div class="action-section">
        <button @click="deleteOldLogs" class="delete-old-btn" :disabled="loading">
          🗑️ 删除30天前的旧日志
        </button>
      </div>
    </div>

    <div v-if="selectedLog" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>命令日志详情</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">日志ID</span>
              <span class="detail-value">#{{ selectedLog.id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">命令</span>
              <span class="detail-value" :class="getCommandClass(selectedLog.command)">
                {{ getCommandText(selectedLog.command) }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">执行者ID</span>
              <span class="detail-value">{{ selectedLog.user_id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">目标用户ID</span>
              <span class="detail-value">{{ selectedLog.target_user_id || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">群组ID</span>
              <span class="detail-value">{{ selectedLog.group_id || '私聊' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">权限等级</span>
              <span class="detail-value" :class="getAuthClass(selectedLog.auth_level)">
                {{ getAuthText(selectedLog.auth_level) }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">协管执行</span>
              <span class="detail-value">{{ selectedLog.is_co_admin ? '是' : '否' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">裁决消耗</span>
              <span class="detail-value">{{ selectedLog.ruling_cost }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">执行状态</span>
              <span class="detail-value" :class="selectedLog.success ? 'success' : 'failed'">
                {{ selectedLog.success ? '成功' : '失败' }}
              </span>
            </div>
            <div class="detail-item">
              <span class="detail-label">执行时间</span>
              <span class="detail-value">{{ selectedLog.created_at }}</span>
            </div>
          </div>
          <div class="detail-section">
            <h3>参数</h3>
            <pre class="params-code">{{ formatParams(selectedLog.params) }}</pre>
          </div>
          <div v-if="selectedLog.error_message" class="detail-section error-section">
            <h3>错误信息</h3>
            <p class="error-text">{{ selectedLog.error_message }}</p>
          </div>
          <div class="detail-section">
            <h3>原因说明</h3>
            <div v-if="selectedLog.reason" class="reason-display">
              {{ selectedLog.reason }}
            </div>
            <div v-else>
              <textarea
                v-model="editReason"
                class="reason-textarea"
                placeholder="输入原因说明..."
                rows="3"
              ></textarea>
            </div>
            <div v-if="!selectedLog.reason" class="modal-actions">
              <button
                @click="saveReason"
                class="action-btn save-btn"
                :disabled="!editReason.trim() || saving"
              >
                💾 保存原因
              </button>
              <button
                @click="closeModal"
                class="action-btn cancel-btn"
              >
                ✕ 取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { commandLogApi } from '../api'
import type { CommandLog, CommandStats, UserStat, CoAdminStat } from '../api/commandLog'

const logs = ref<CommandLog[]>([])
const loading = ref(false)
const loadError = ref('')
const currentPage = ref(1)
const pageSize = ref(50)
const totalPages = ref(0)
const total = ref(0)
const activeTab = ref('all')
const commandFilter = ref('')
const successFilter = ref('')
const selectedLog = ref<CommandLog | null>(null)
const editReason = ref('')
const saving = ref(false)
const commandStats = ref<CommandStats>({})
const userStats = ref<UserStat[]>([])
const coAdminStats = ref<CoAdminStat[]>([])

const commandStatsTotal = computed(() => {
  return Object.values(commandStats.value).reduce((sum, count) => sum + count, 0)
})

const userStatsTotal = computed(() => {
  return userStats.value.length
})

const coAdminCostTotal = computed(() => {
  return coAdminStats.value.reduce((sum, stat) => sum + stat.total_cost, 0)
})

function getCommandText(command: string): string {
  const commandMap: Record<string, string> = {
    ban: '封禁',
    unban: '解禁',
    mute: '禁言',
    unmute: '解禁言',
    kick: '踢出',
    recall: '撤回',
    verify: '验证',
    credit: '积分'
  }
  return commandMap[command] || command
}

function getAuthText(auth: string): string {
  const authMap: Record<string, string> = {
    admin: '管理员',
    co_admin: '协管员',
    member: '成员'
  }
  return authMap[auth] || auth
}

function getCommandClass(command: string): string {
  return `command-${command}`
}

function getAuthClass(auth: string): string {
  return `auth-${auth}`
}

function formatTime(time: string): string {
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatParams(params: string): string {
  try {
    const parsed = JSON.parse(params)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return params
  }
}

async function loadLogs() {
  loading.value = true
  loadError.value = ''
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    
    if (commandFilter.value) {
      params.command = commandFilter.value
    }
    
    if (successFilter.value !== '') {
      params.success = successFilter.value === 'true'
    }
    
    let response
    switch (activeTab.value) {
      case 'co-admin':
        response = await commandLogApi.getCoAdminLogs(params)
        break
      case 'failed':
        response = await commandLogApi.getFailedLogs(params)
        break
      default:
        response = await commandLogApi.getCommandLogs(params)
    }
    
    if (response.code === 200) {
      logs.value = response.data
      total.value = response.pagination?.total || 0
      totalPages.value = response.pagination?.totalPages || 0
    } else {
      loadError.value = response.message || '加载日志失败'
    }
  } catch (error) {
    console.error('加载日志失败:', error)
    loadError.value = '加载日志失败，请检查后台服务是否启动'
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const [commandRes, userRes, coAdminRes] = await Promise.all([
      commandLogApi.getCommandStats(),
      commandLogApi.getUserStats(),
      commandLogApi.getCoAdminStats()
    ])
    
    if (commandRes.code === 200) {
      commandStats.value = commandRes.data
    }
    if (userRes.code === 200) {
      userStats.value = userRes.data
    }
    if (coAdminRes.code === 200) {
      coAdminStats.value = coAdminRes.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

function handleTabChange() {
  currentPage.value = 1
  loadLogs()
}

function handleFilterChange() {
  currentPage.value = 1
  loadLogs()
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadLogs()
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadLogs()
  }
}

function viewDetail(log: CommandLog) {
  selectedLog.value = log
  editReason.value = log.reason || ''
}

function closeModal() {
  selectedLog.value = null
  editReason.value = ''
}

function addReason(log: CommandLog) {
  selectedLog.value = log
  editReason.value = ''
}

async function saveReason() {
  if (!selectedLog.value || !editReason.value.trim()) return
  
  saving.value = true
  try {
    const response = await commandLogApi.addReason(selectedLog.value.id, { reason: editReason.value.trim() })
    if (response.code === 200) {
      const index = logs.value.findIndex(l => l.id === selectedLog.value!.id)
      if (index !== -1) {
        const log = logs.value[index]
        if (log) {
          log.reason = editReason.value.trim()
        }
      }
      if (selectedLog.value) {
        selectedLog.value.reason = editReason.value.trim()
      }
    }
  } catch (error) {
    console.error('保存原因失败:', error)
    alert('保存原因失败，请重试')
  } finally {
    saving.value = false
  }
}

async function deleteOldLogs() {
  if (!confirm('确定要删除30天前的所有日志吗？此操作不可恢复。')) return
  
  loading.value = true
  try {
    const response = await commandLogApi.deleteOldLogs({ days: 30 })
    if (response.code === 200) {
      alert(response.message)
      loadLogs()
      loadStats()
    } else {
      alert(response.message || '删除失败')
    }
  } catch (error) {
    console.error('删除日志失败:', error)
    alert('删除日志失败，请重试')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadLogs()
  loadStats()
})
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.command-log-management {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
  overflow-x: auto;
}

.management-header {
  margin-bottom: 24px;

  h1 {
    font-size: 24px;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .filter-select {
    padding: 8px 12px;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    font-size: 14px;
    background: $color-bg-primary;
    cursor: pointer;
    transition: all $transition-base;

    &:focus {
      outline: none;
      border-color: $color-secondary;
      box-shadow: 0 0 0 3px rgba(155, 89, 182, 0.1);
    }
  }

  .refresh-btn {
    padding: 8px 16px;
    background: $color-secondary;
    color: $color-text-white;
    border: 1px solid $color-secondary;
    border-radius: $radius-md;
    cursor: pointer;
    font-size: 14px;
    transition: all $transition-base;

    &:hover:not(:disabled) {
      background: $color-purple-dark;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: $color-bg-secondary;
  border-radius: $radius-lg;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: $shadow-md;

  .stat-icon {
    font-size: 32px;
  }

  .stat-info {
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: $color-text-primary;
    }

    .stat-label {
      font-size: 13px;
      color: $color-text-secondary;
    }
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: $color-text-secondary;

  .loading-icon {
    font-size: 48px;
    margin-bottom: 12px;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    font-size: 16px;
    font-weight: 500;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: $color-danger;

  .error-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .error-text {
    font-size: 16px;
    font-weight: 500;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: $color-text-light;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 16px;
    font-weight: 500;
  }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.logs-table {
  overflow-x: auto;
  background: $color-bg-secondary;
  border-radius: $radius-lg;
  box-shadow: $shadow-md;
}

.data-table {
  width: 100%;
  border-collapse: collapse;

  thead {
    background: $color-bg-primary;

    th {
      padding: 12px 16px;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: $color-text-secondary;
      border-bottom: 2px solid $color-border-light;
      white-space: nowrap;
    }
  }

  tbody {
    .table-row {
      transition: background-color $transition-base;

      &:hover {
        background: rgba(155, 89, 182, 0.05);
      }

      &:nth-child(even) {
        background: $color-bg-primary;
      }
    }

    td {
      padding: 12px 16px;
      font-size: 14px;
      color: $color-text-primary;
      border-bottom: 1px solid $color-border-light;
      white-space: nowrap;
    }
  }
}

.cell-id {
  font-size: 12px;
  color: $color-text-light;
  font-weight: 500;
}

.cell-command {
  font-weight: 600;
  padding: 4px 12px;
  border-radius: $radius-sm;

  &.command-ban { background: rgba(231, 76, 60, 0.1); color: #ef4444; }
  &.command-unban { background: rgba(46, 204, 113, 0.1); color: $color-success; }
  &.command-mute { background: rgba(241, 196, 15, 0.1); color: #f39c12; }
  &.command-unmute { background: rgba(46, 204, 113, 0.1); color: $color-success; }
  &.command-kick { background: rgba(231, 76, 60, 0.1); color: #ef4444; }
  &.command-recall { background: rgba(155, 89, 182, 0.1); color: $color-secondary; }
  &.command-verify { background: rgba(52, 152, 219, 0.1); color: #3498db; }
  &.command-credit { background: rgba(46, 204, 113, 0.1); color: $color-success; }
}

.cell-auth {
  font-weight: 600;
  padding: 4px 12px;
  border-radius: $radius-sm;

  &.auth-admin { background: rgba(231, 76, 60, 0.1); color: #ef4444; }
  &.auth-co_admin { background: rgba(241, 196, 15, 0.1); color: #f39c12; }
  &.auth-member { background: rgba(149, 165, 166, 0.1); color: $color-text-secondary; }
}

.cell-co-admin {
  .badge-co-admin {
    background: rgba(241, 196, 15, 0.1);
    color: #f39c12;
    padding: 4px 12px;
    border-radius: $radius-sm;
    font-size: 12px;
    font-weight: 600;
  }

  .badge-normal {
    background: rgba(149, 165, 166, 0.1);
    color: $color-text-light;
    padding: 4px 12px;
    border-radius: $radius-sm;
    font-size: 12px;
    font-weight: 600;
  }
}

.cell-status {
  .badge-success {
    background: rgba(46, 204, 113, 0.1);
    color: $color-success;
    padding: 4px 12px;
    border-radius: $radius-sm;
    font-size: 12px;
    font-weight: 600;
  }

  .badge-failed {
    background: rgba(231, 76, 60, 0.1);
    color: #ef4444;
    padding: 4px 12px;
    border-radius: $radius-sm;
    font-size: 12px;
    font-weight: 600;
  }
}

.cell-cost {
  font-weight: 600;
  color: $color-secondary;
}

.cell-actions {
  display: flex;
  gap: 8px;

  .action-btn {
    padding: 6px 12px;
    border-radius: $radius-md;
    cursor: pointer;
    font-size: 14px;
    border: none;
    transition: all $transition-base;
  }

  .view-btn {
    background: $color-secondary;
    color: $color-text-white;

    &:hover {
      background: $color-purple-dark;
    }
  }

  .reason-btn {
    background: $color-primary;
    color: $color-text-white;

    &:hover {
      background: $color-purple-dark;
    }
  }
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 0;

  .pagination-btn {
    padding: 8px 16px;
    background: $color-bg-secondary;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    cursor: pointer;
    font-size: 14px;
    transition: all $transition-base;

    &:hover:not(:disabled) {
      background: $color-secondary;
      color: $color-text-white;
      border-color: $color-secondary;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .pagination-info {
    font-size: 14px;
    color: $color-text-secondary;
  }
}

.action-section {
  display: flex;
  justify-content: center;
  padding-bottom: 20px;

  .delete-old-btn {
    padding: 10px 24px;
    background: $color-danger;
    color: $color-text-white;
    border: 1px solid $color-danger;
    border-radius: $radius-md;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all $transition-base;

    &:hover:not(:disabled) {
      background: #c0392b;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.modal-content {
  background: $color-bg-secondary;
  border-radius: $radius-lg;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: $shadow-xl;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid $color-border;

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: $color-text-secondary;
    padding: 0;
    transition: color $transition-base;

    &:hover {
      color: $color-text-primary;
    }
  }
}

.modal-body {
  padding: 20px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;

  .detail-label {
    font-size: 14px;
    color: $color-text-secondary;
    font-weight: 500;
  }

  .detail-value {
    font-size: 14px;
    color: $color-text-primary;
    font-weight: 600;

    &.success { color: $color-success; }
    &.failed { color: $color-danger; }
  }
}

.detail-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  &.error-section {
    background: rgba(231, 76, 60, 0.05);
    padding: 16px;
    border-radius: $radius-md;
    border: 1px solid rgba(231, 76, 60, 0.2);

    h3 {
      color: $color-danger;
    }
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 12px;
  }
}

.params-code {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: $radius-md;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
}

.error-text {
  color: $color-danger;
  font-size: 14px;
  line-height: 1.6;
}

.reason-display {
  padding: 12px;
  background: $color-bg-primary;
  border: 1px solid $color-border-light;
  border-radius: $radius-md;
  font-size: 14px;
  color: $color-text-primary;
  line-height: 1.6;
}

.reason-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  transition: all $transition-base;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: $color-secondary;
    box-shadow: 0 0 0 3px rgba(155, 89, 182, 0.1);
  }
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid $color-border;
  margin-top: 16px;

  .save-btn {
    background: $color-success;
    color: $color-text-white;
    border: 1px solid $color-success;

    &:hover:not(:disabled) {
      background: #219150;
    }
  }

  .cancel-btn {
    background: $color-text-secondary;
    color: $color-text-white;
    border: 1px solid $color-text-secondary;

    &:hover:not(:disabled) {
      background: $color-text-primary;
    }
  }
}

@media (max-width: 768px) {
  .command-log-management {
    padding: 10px;
  }

  .management-header {
    h1 {
      font-size: 20px;
      margin-bottom: 12px;
    }

    .actions {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;

      .filter-group {
        flex-direction: column;
        align-items: stretch;

        .filter-select {
          width: 100%;
        }
      }

      .refresh-btn {
        width: 100%;
      }
    }
  }

  .stats-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .modal-content {
    max-width: 90%;
  }
}
</style>
