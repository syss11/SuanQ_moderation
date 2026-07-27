<template>
  <div class="logs">
    <div class="logs-header">
      <h1>系统日志</h1>
      <div class="filters">
        <button 
          v-for="level in levels" 
          :key="level"
          @click="filterByLevel(level)"
          :class="{ active: selectedLevel === level }"
          class="filter-btn"
        >
          {{ level }}
        </button>
        
        
        <button @click="exportLogs" class="export-btn">
          📥 导出
        </button>
        <button @click="clearLogs" class="clear-btn">
          清空
        </button>
      </div>
    </div>

    <div class="logs-container">
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
        <span class="empty-text">暂无日志</span>
      </div>
      
      <div v-else class="logs-list" ref="logsListRef">
        <div 
          v-for="(log, index) in logs" 
          :key="log.timestamp || index"
          :class="['log-item', `log-${log.level.toLowerCase()}`]"
        >
          <div class="log-header">
            <span class="log-level">{{ getLevelIcon(log.level) }}</span>
            <span class="log-time">{{ formatTime(log.timestamp) }}</span>
            <span v-if="log.prefix" class="log-prefix">{{ log.prefix }}</span>
          </div>
          <div class="log-message">{{ log.message }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useWebSocket } from '../composables/useWebSocket'
import { useUserStore } from '../stores/user'
import { logsApi } from '../api/logs'
import type { LogEntry } from '../utils/websocket'

const levels = ['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'LOG'] as const
const selectedLevel = ref<string>('ALL')
const logs = ref<LogEntry[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const logsListRef = ref<HTMLElement | null>(null)
const loadError = ref('')

function getLevelIcon(level: string): string {
  const icons: Record<string, string> = {
    'DEBUG': '🔍',
    'INFO': 'ℹ️',
    'WARN': '⚠️',
    'ERROR': '❌',
    'LOG': '📝'
  }
  return icons[level] || '📋'
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

async function fetchHistory() {
  loading.value = true
  loadError.value = ''
  try {
    const params: any = {
      limit: 100
    }

    if (selectedLevel.value !== 'ALL') {
      params.level = selectedLevel.value
    }

    if (searchKeyword.value) {
      params.keyword = searchKeyword.value
    }

    const response = await logsApi.getLogs(params)
    if (response.code === 200) {
      logs.value = response.data
    } else {
      loadError.value = response.message || '获取日志失败'
    }
  } catch (error) {
    console.error('获取历史日志失败:', error)
    loadError.value = '加载日志失败，请检查后台服务是否启动'
  } finally {
    loading.value = false
  }
}

function addLogs(newLogs: LogEntry[]) {
  
  logs.value = [ ...logs.value, ...newLogs]
  
  nextTick(() => {
    scrollToBottom()
  })
}

function scrollToBottom() {
  if (logsListRef.value) {
    logsListRef.value.scrollTop = logsListRef.value.scrollHeight
  }
}

function filterByLevel(level: string) {
  selectedLevel.value = level
  logs.value = []
  fetchHistory()
}

function clearLogs() {
  logs.value = []
}

async function exportLogs() {
  try {
    const exportData = logs.value
      .filter(log => {
        if (selectedLevel.value !== 'ALL' && log.level !== selectedLevel.value) {
          return false
        }
        if (searchKeyword.value && !log.message.includes(searchKeyword.value)) {
          return false
        }
        return true
      })
      .map(log => {
        const time = formatTime(log.timestamp)
        const level = log.level
        const prefix = log.prefix || ''
        const message = log.message
        return `[${time}] [${level}] ${prefix} ${message}`
      })
      .join('\n')
    
    const blob = new Blob([exportData], { type: 'text/plain;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `logs_${new Date().getTime()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出日志失败:', error)
  }
}

onMounted(() => {
  fetchHistory()
  
  const { wsClient, connect } = useWebSocket()
  const userStore = useUserStore()
  
  if (userStore.token && !wsClient.value) {
    connect(userStore.token)
  }
  
  if (wsClient.value) {
    wsClient.value.setCallbacks({
      onLogs: (newLogs) => {
        addLogs(newLogs)
      }
    })
  }
})

onUnmounted(() => {
  const { wsClient } = useWebSocket()
  
  if (wsClient.value) {
    wsClient.value.setCallbacks({
      onLogs: () => {}
    })
  }
})
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.logs {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  overflow-x: hidden;
}

.logs-header {
  margin-bottom: 16px;

  h1 {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 16px;
  }

  .filters {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .filter-btn {
    padding: 6px 12px;
    background: $color-bg-secondary;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    cursor: pointer;
    font-size: 13px;
    color: $color-text-secondary;
    transition: all $transition-base;

    &:hover {
      background: $color-bg-dark;
      border-color: $color-secondary;
    }

    &.active {
      background: $color-secondary;
      color: $color-text-white;
      border-color: $color-secondary;
    }
  }

  .search-box {
    display: flex;
    align-items: center;
    margin-left: auto;
    margin-right: 8px;

    .search-input {
      padding: 6px 10px;
      padding-right: 26px;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      font-size: 13px;
      width: 180px;
      transition: all $transition-base;

      &:focus {
        outline: none;
        border-color: $color-secondary;
        box-shadow: 0 0 0 3px rgba(155, 89, 182, 0.1);
      }

      &::placeholder {
        color: $color-text-light;
      }
    }

    .clear-search-btn {
      position: absolute;
      right: 8px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      color: $color-text-light;
      padding: 0;

      &:hover {
        color: $color-text-secondary;
      }
    }
  }

  .export-btn {
    margin-left: auto;
    padding: 6px 12px;
    background: $color-success;
    border: 1px solid $color-success;
    border-radius: $radius-sm;
    cursor: pointer;
    font-size: 13px;
    color: $color-text-white;
    transition: all $transition-base;

    &:hover {
      background: #219150;
    }
  }

  .clear-btn {
    padding: 6px 12px;
    background: $color-danger;
    border: 1px solid $color-danger;
    border-radius: $radius-sm;
    cursor: pointer;
    font-size: 13px;
    color: $color-text-white;
    transition: all $transition-base;

    &:hover {
      background: #c0392b;
    }
  }
}

.logs-container {
  background: $color-bg-secondary;
  border-radius: $radius-md;
  padding: 12px;
  min-height: 400px;
  box-shadow: $shadow-md;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: $color-text-secondary;

  .loading-icon {
    font-size: 40px;
    margin-bottom: 8px;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    font-size: 14px;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: $color-text-light;

  .empty-icon {
    font-size: 40px;
    margin-bottom: 8px;
  }

  .empty-text {
    font-size: 14px;
    font-weight: 500;
  }
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: $color-danger;

  .error-icon {
    font-size: 40px;
    margin-bottom: 8px;
  }

  .error-text {
    font-size: 14px;
    font-weight: 500;
  }
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 600px;
  overflow-y: auto;
}

.log-item {
  padding: 10px 12px;
  border-radius: $radius-sm;
  border-left: 3px solid;
  transition: all $transition-base;

  &.log-debug {
    background: rgba(52, 152, 219, 0.05);
    border-left-color: #3498db;
  }

  &.log-info {
    background: rgba(52, 152, 219, 0.05);
    border-left-color: #3498db;
  }

  &.log-warn {
    background: rgba(251, 146, 60, 0.05);
    border-left-color: #f39c12;
  }

  &.log-error {
    background: rgba(231, 76, 60, 0.05);
    border-left-color: #e74c3c;
  }

  &.log-log {
    background: rgba(149, 165, 166, 0.05);
    border-left-color: #95a5a6;
  }

  .log-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .log-level {
    font-size: 14px;
  }

  .log-time {
    font-size: 11px;
    color: $color-text-light;
    font-family: monospace;
  }

  .log-prefix {
    font-size: 11px;
    color: $color-text-light;
    font-weight: 500;
  }

  .log-message {
    font-size: 13px;
    color: $color-text-primary;
    line-height: 1.5;
    word-break: break-all;
  }
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 16px 0;

  .load-more-btn {
    padding: 8px 20px;
    background: $color-secondary;
    border: 1px solid $color-secondary;
    border-radius: $radius-sm;
    cursor: pointer;
    font-size: 13px;
    color: $color-text-white;
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

@media (max-width: 768px) {
  .logs {
    padding: 10px;
  }

  .logs-header {
    h1 {
      font-size: 18px;
      margin-bottom: 12px;
    }

    .filters {
      gap: 6px;

      .filter-btn {
        padding: 5px 10px;
        font-size: 12px;
      }

      .search-box {
        margin-left: 0;
        margin-right: 6px;
        flex: 1;

        .search-input {
          width: 100%;
          font-size: 12px;
          padding: 5px 8px;
          padding-right: 20px;
        }
      }

      .export-btn, .clear-btn {
        padding: 5px 10px;
        font-size: 12px;
      }
    }
  }

  .logs-container {
    padding: 8px;
    min-height: 300px;
  }

  .loading-state, .empty-state, .error-state {
    padding: 30px 20px;

    .loading-icon, .empty-icon, .error-icon {
      font-size: 32px;
      margin-bottom: 6px;
    }

    .loading-text, .empty-text, .error-text {
      font-size: 12px;
    }
  }

  .logs-list {
    max-height: 400px;
  }

  .log-item {
    padding: 8px 10px;

    .log-header {
      gap: 8px;
      margin-bottom: 3px;
    }

    .log-level {
      font-size: 12px;
    }

    .log-time {
      font-size: 10px;
    }

    .log-prefix {
      font-size: 10px;
    }

    .log-message {
      font-size: 12px;
    }
  }
}

@media (max-width: 480px) {
  .logs-header {
    .filters {
      flex-direction: column;
      align-items: stretch;

      .search-box {
        margin-right: 0;
        margin-bottom: 8px;
      }

      .export-btn, .clear-btn {
        width: 100%;
      }
    }
  }

  .logs-container {
    padding: 6px;
  }

  .log-item {
    padding: 6px 8px;
  }
}
</style>