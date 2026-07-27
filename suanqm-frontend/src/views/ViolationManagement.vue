<template>
  <div class="violation-management">
    <div class="management-header">
      <h1>违规记录管理</h1>
      <div class="actions">
        <div class="filter-group">
          <select v-model="statusFilter" @change="handleFilterChange" class="filter-select">
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="deleted">已删除</option>
            <option value="pending">待处理</option>
          </select>
          <select v-model="typeFilter" @change="handleFilterChange" class="filter-select">
            <option value="">全部类型</option>
            <option value="flood">刷屏</option>
            <option value="advertising">广告</option>
            <option value="political_or_rumor">涉政</option>
            <option value="violence_or_sexual">黄暴</option>
            <option value="illegal_software">非法软件</option>
            <option value="insult_or_attack">攻击</option>
            <option value="doxxing_or_threatening">威胁</option>
            <option value="other">其他</option>
          </select>
        </div>
        <button @click="loadViolations" class="refresh-btn" :disabled="loading">
          🔄 刷新
        </button>
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

    <div v-else-if="violations.length === 0" class="empty-state">
      <span class="empty-icon">📋</span>
      <span class="empty-text">暂无违规记录</span>
    </div>

    <div v-else class="content">
      <div class="violations-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>违规类型</th>
              <th>严重程度</th>
              <th>用户ID</th>
              <th>时间</th>
              <th>积分变化</th>
              <th>惩罚类型</th>
              <th>惩罚时长</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="violation in violations" :key="violation.id" class="table-row">
              <td class="cell-id">#{{ violation.id }}</td>
              <td class="cell-type" :class="getTypeClass(violation.violation_type)">
                {{ getTypeText(violation.violation_type) }}
              </td>
              <td class="cell-severity" :class="getSeverityClass(violation.severity)">
                {{ violation.severity }}
              </td>
              <td class="cell-user">{{ violation.user_id }}</td>
              <td class="cell-time">{{ formatTime(violation.time) }}</td>
              <td class="cell-credit" :class="getCreditClass(violation.credit_change)">
                {{ violation.credit_change > 0 ? '+' : '' }}{{ violation.credit_change }}
              </td>
              <td class="cell-penalty">{{ getPenaltyText(violation.penalty_type) }}</td>
              <td class="cell-duration">{{ violation.penalty_time ? formatDuration(violation.penalty_time) : '-' }}</td>
              <td class="cell-status" :class="getStatusClass(violation.status)">
                {{ getStatusText(violation.status) }}
              </td>
              <td class="cell-actions">
                <button @click="viewDetail(violation)" class="action-btn view-btn">👁️</button>
                <button @click="editViolation(violation)" class="action-btn edit-btn">✏️</button>
                <button v-if="violation.status === 'active'" @click="updateStatus(violation.id, 'deleted')" class="action-btn delete-btn">🗑️</button>
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
    </div>

    <div v-if="selectedViolation" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>违规记录详情</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <h3>基本信息</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">记录ID</span>
                <span class="detail-value">#{{ selectedViolation.id }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">用户ID</span>
                <span class="detail-value">{{ selectedViolation.user_id }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">违规时间</span>
                <span class="detail-value">{{ formatTime(selectedViolation.time) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">违规类型</span>
                <span class="detail-value">{{ getTypeText(selectedViolation.violation_type) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">严重程度</span>
                <span class="detail-value" :class="getSeverityClass(selectedViolation.severity)">
                  {{ selectedViolation.severity }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">积分变化</span>
                <span class="detail-value" :class="getCreditClass(selectedViolation.credit_change)">
                  {{ selectedViolation.credit_change > 0 ? '+' : '' }}{{ selectedViolation.credit_change }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">惩罚类型</span>
                <span class="detail-value">{{ getPenaltyText(selectedViolation.penalty_type) }}</span>
              </div>
              <div v-if="selectedViolation.penalty_time" class="detail-item">
                <span class="detail-label">惩罚时长</span>
                <span class="detail-value">{{ formatDuration(selectedViolation.penalty_time) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">状态</span>
                <span class="detail-value" :class="getStatusClass(selectedViolation.status)">
                  {{ getStatusText(selectedViolation.status) }}
                </span>
              </div>
            </div>
          </div>
          <div class="detail-section">
            <h3>描述</h3>
            <div class="description-editor">
              <textarea
                v-model="editDescription"
                class="description-textarea"
                placeholder="输入违规描述..."
                rows="4"
              ></textarea>
            </div>
            <div class="modal-actions">
              <button
                @click="saveDescription"
                class="action-btn save-btn"
                :disabled="saving"
              >
                💾 保存
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
import { ref, onMounted } from 'vue'
import { violationApi } from '../api'
import type { Violation, ViolationType, ViolationStatus } from '../types/api'

const violations = ref<Violation[]>([])
const loading = ref(false)
const loadError = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const totalPages = ref(0)
const total = ref(0)
const statusFilter = ref('')
const typeFilter = ref('')
const selectedViolation = ref<Violation | null>(null)
const editDescription = ref('')
const saving = ref(false)

function getTypeText(type: ViolationType): string {
  const typeMap: Record<ViolationType, string> = {
    flood: '刷屏',
    advertising: '广告',
    political_or_rumor: '政冶谣言',
    violence_or_sexual: '暴力色情',
    illegal_software: '非法软件',
    insult_or_attack: '侮辱攻击',
    doxxing_or_threatening: '开盒威胁',
    other: '其他'
  }
  return typeMap[type] || type
}

function getStatusText(status: ViolationStatus): string {
  const statusMap: Record<ViolationStatus, string> = {
    active: '活跃',
    deleted: '已删除',
    pending: '待处理'
  }
  return statusMap[status] || status
}

function getPenaltyText(type: string): string {
  const penaltyMap: Record<string, string> = {
    mute: '禁言',
    kick: '踢出',
    ban: '封禁',
    warning: '警告',
    none: '无'
  }
  return penaltyMap[type] || type
}

function getTypeClass(type: ViolationType): string {
  return `type-${type}`
}

function getStatusClass(status: ViolationStatus): string {
  return `status-${status}`
}

function getSeverityClass(severity: number): string {
  if (severity >= 4) return 'severity-high'
  if (severity >= 3) return 'severity-medium'
  return 'severity-low'
}

function getCreditClass(creditChange: number): string {
  if (creditChange > 0) return 'credit-positive'
  if (creditChange < 0) return 'credit-negative'
  return 'credit-neutral'
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`
}

async function loadViolations() {
  loading.value = true
  loadError.value = ''
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    
    if (statusFilter.value) {
      params.status = statusFilter.value
    }
    
    if (typeFilter.value) {
      params.violation_type = typeFilter.value
    }
    
    const response = await violationApi.getAllViolations(params)
    if (response.code === 200) {
      violations.value = response.data
      total.value = response.pagination?.total || 0
      totalPages.value = response.pagination?.totalPages || 0
    } else {
      loadError.value = response.message || '加载违规记录失败'
    }
  } catch (error) {
    console.error('加载违规记录失败:', error)
    loadError.value = '加载违规记录失败，请检查后台服务是否启动'
  } finally {
    loading.value = false
  }
}

function handleFilterChange() {
  currentPage.value = 1
  loadViolations()
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadViolations()
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadViolations()
  }
}

function viewDetail(violation: Violation) {
  selectedViolation.value = violation
  editDescription.value = violation.description
}

function closeModal() {
  selectedViolation.value = null
  editDescription.value = ''
}

function editViolation(violation: Violation) {
  selectedViolation.value = violation
  editDescription.value = violation.description
}

async function saveDescription() {
  if (!selectedViolation.value) return
  
  saving.value = true
  try {
    const response = await violationApi.updateViolationStatus(selectedViolation.value.id, { status: 'pending' })
    if (response.code === 200) {
      const index = violations.value.findIndex(v => v.id === selectedViolation.value!.id)
      if (index !== -1) {
        const violation = violations.value[index]
        if (violation) {
          violation.description = editDescription.value
          violation.status = 'pending'
        }
      }
      closeModal()
    }
  } catch (error) {
    console.error('保存描述失败:', error)
    alert('保存描述失败，请重试')
  } finally {
    saving.value = false
  }
}

async function updateStatus(id: number, status: ViolationStatus) {
  try {
    const response = await violationApi.updateViolationStatus(id, { status })
    if (response.code === 200) {
      const index = violations.value.findIndex(v => v.id === id)
      if (index !== -1) {
        const violation = violations.value[index]
        if (violation) {
          violation.status = status
        }
      }
    }
  } catch (error) {
    console.error('更新状态失败:', error)
    alert('更新状态失败，请重试')
  }
}

onMounted(() => {
  loadViolations()
})
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.violation-management {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  overflow-x: hidden;
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

.violations-table {
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

.cell-type {
  font-weight: 600;
  padding: 4px 12px;
  border-radius: $radius-sm;

  &.type-flood { background: rgba(52, 152, 219, 0.1); }
  &.type-advertising { background: rgba(241, 196, 15, 0.1); }
  &.type-political_or_rumor { background: rgba(231, 76, 60, 0.1); }
  &.type-violence_or_sexual { background: rgba(231, 76, 60, 0.1); }
  &.type-illegal_software { background: rgba(155, 89, 182, 0.1); }
  &.type-insult_or_attack { background: rgba(231, 76, 60, 0.1); }
  &.type-doxxing_or_threatening { background: rgba(231, 76, 60, 0.1); }
  &.type-other { background: rgba(149, 165, 166, 0.1); }
}

.cell-severity {
  font-weight: 600;
  padding: 4px 12px;
  border-radius: $radius-sm;

  &.severity-low { background: rgba(46, 204, 113, 0.1); color: $color-success; }
  &.severity-medium { background: rgba(241, 196, 15, 0.1); color: #f39c12; }
  &.severity-high { background: rgba(231, 76, 60, 0.1); color: #ef4444; }
}

.cell-credit {
  font-weight: 600;

  &.credit-positive { color: $color-success; }
  &.credit-negative { color: $color-danger; }
  &.credit-neutral { color: $color-text-secondary; }
}

.cell-status {
  font-weight: 600;
  padding: 4px 12px;
  border-radius: $radius-sm;

  &.status-active { background: rgba(46, 204, 113, 0.1); color: $color-success; }
  &.status-deleted { background: rgba(149, 165, 166, 0.1); color: $color-text-light; }
  &.status-pending { background: rgba(241, 196, 15, 0.1); color: #f39c12; }
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

  .edit-btn {
    background: $color-primary;
    color: $color-text-white;

    &:hover {
      background: $color-purple-dark;
    }
  }

  .delete-btn {
    background: $color-danger;
    color: $color-text-white;

    &:hover {
      background: #c0392b;
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
  max-width: 700px;
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

.detail-section {
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 16px;
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
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

    &.credit-positive { color: $color-success; }
    &.credit-negative { color: $color-danger; }
    &.credit-neutral { color: $color-text-secondary; }
  }
}

.description-editor {
  margin-bottom: 16px;

  .description-textarea {
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
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid $color-border;

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
  .violation-management {
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

  .modal-content {
    max-width: 90%;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .pagination {
    flex-direction: column;
    gap: 8px;

    .pagination-btn {
      width: 100%;
    }
  }
}
</style>
