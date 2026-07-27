<template>
  <div class="settings">
    <div class="settings-header">
      <h1>系统配置</h1>
      <div class="actions">
        <button @click="loadConfig" class="load-btn" :disabled="loading">
          📥 重新加载
        </button>
        <button @click="saveConfig" class="save-btn" :disabled="loading || !hasChanges">
          💾 保存配置
        </button>
        <button @click="applyConfig" class="apply-btn" :disabled="loading || hasUnsavedChanges">
          🔄 应用配置
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

    <div v-else-if="Object.keys(config).length === 0" class="empty-state">
      <span class="empty-icon">⚙️</span>
      <span class="empty-text">暂无配置</span>
    </div>

    <div v-else class="config-container">
      <div v-if="hasUnsavedChanges" class="unsaved-warning">
        <span class="warning-icon">⚠️</span>
        <span class="warning-text">您有未保存的更改</span>
      </div>

      <div v-if="parseError" class="parse-error">
        <span class="error-icon">❌</span>
        <span class="error-text">{{ parseError }}</span>
      </div>

      <div class="editor-container">
        <textarea
          v-model="editingValue"
          class="json-editor"
          placeholder="在此编辑 JSON5 配置..."
          @input="validateJson5"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { settingsApi, systemApi } from '../api'
import JSON5 from 'json5'
const config = ref<Record<string, any>>({})
const loading = ref(false)
const editingValue = ref('')
const parseError = ref('')
const originalContent = ref('')
const loadError = ref('')

const hasChanges = computed(() => {
  return editingValue.value !== originalContent.value
})

const hasUnsavedChanges = computed(() => {
  return editingValue.value !== originalContent.value
})

async function loadConfig() {
  loading.value = true
  loadError.value = ''
  try {
    const response = await settingsApi.getConfig()
    if (response.code === 200) {
      originalContent.value = response.data.content
      editingValue.value = response.data.content
      try {
        config.value = JSON5.parse(response.data.content)
      } catch (error) {
        console.error('解析配置失败:', error)
        config.value = {}
      }
    } else {
      loadError.value = response.message || '加载配置失败'
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    loadError.value = '加载配置失败，请检查后台服务是否启动'
  } finally {
    loading.value = false
  }
}

async function saveConfig():Promise<boolean> {
  if (parseError.value) {
    console.error('无法保存：JSON5 语法错误')
    return false
  }
  
  loading.value = true
  try {
    const content = editingValue.value
    const response = await settingsApi.saveConfig({ content })
    if (response.code === 200) {
      originalContent.value = editingValue.value
      try {
        config.value = JSON5.parse(editingValue.value)
      } catch (error) {
        console.error('解析配置失败:', error)
        config.value = {}
      }
    }
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  } finally {
    loading.value = false
    return true
  }
}

function validateJson5() {
  if (!editingValue.value.trim()) {
    parseError.value = ''
    return
  }
  
  try {
    JSON5.parse(editingValue.value)
    parseError.value = ''
  } catch (error) {
    parseError.value = `JSON5 语法错误: ${error instanceof Error ? error.message : '未知错误'}`
  }
}

async function applyConfig() {
  loading.value = true
  if (!confirm('确认应用配置吗？这将重启系统,短时间内无法继续操作')) {
    loading.value = false
    return
  }
  try {
    const saved = await saveConfig()
    if (!saved) {
      return
    }
    const response = await systemApi.shutdown()
    if (response.code === 200) {
      alert('配置应用成功，系统将重启')
    }
  } catch (error) {
    console.error('应用配置失败:', error)
  } finally {
    loading.value = false
  }
}


onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.settings {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  overflow-x: hidden;
}

.settings-header {
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
  }

  .load-btn, .save-btn, .apply-btn {
    padding: 10px 20px;
    border-radius: $radius-md;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all $transition-base;

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .load-btn {
    background: $color-secondary;
    color: $color-text-white;
    border: 1px solid $color-secondary;

    &:hover:not(:disabled) {
      background: $color-purple-dark;
    }
  }

  .save-btn {
    background: $color-success;
    color: $color-text-white;
    border: 1px solid $color-success;

    &:hover:not(:disabled) {
      background: #219150;
    }
  }

  .apply-btn {
    background: rgb(251, 146, 60);
    color: $color-text-white;
    border: 1px solid $color-primary;

    &:hover:not(:disabled) {
      background: $color-purple-dark;
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

.config-container {
  background: $color-bg-secondary;
  border-radius: $radius-lg;
  padding: 24px;
  box-shadow: $shadow-md;
}

.unsaved-warning {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(251, 146, 60, 0.1);
  border-radius: $radius-md;
  margin-bottom: 20px;

  .warning-icon {
    font-size: 20px;
  }

  .warning-text {
    font-size: 14px;
    color: $color-text-primary;
    font-weight: 500;
  }
}

.parse-error {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: $radius-md;
  margin-bottom: 20px;

  .error-icon {
    font-size: 20px;
  }

  .error-text {
    font-size: 14px;
    color: #ef4444;
    font-weight: 500;
  }
}

.editor-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.json-editor {
  width: 100%;
  min-height: 500px;
  padding: 16px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: $color-text-primary;
  background: $color-bg-primary;
  border: 2px solid $color-border;
  border-radius: $radius-md;
  resize: vertical;
  outline: none;
  transition: border-color $transition-base;
  box-sizing: border-box;

  &:focus {
    border-color: $color-primary;
  }

  &::placeholder {
    color: $color-text-light;
  }
}

@media (max-width: 768px) {
  .settings {
    padding: 10px;
  }

  .settings-header {
    h1 {
      font-size: 20px;
    }

    .actions {
      flex-wrap: wrap;
    }

    .load-btn, .save-btn, .apply-btn {
      padding: 8px 12px;
      font-size: 12px;
    }
  }

  .json-editor {
    min-height: 300px;
    font-size: 12px;
    padding: 12px;
  }

  .config-container {
    padding: 16px;
  }

  .unsaved-warning, .parse-error {
    padding: 12px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .settings-header {
    .actions {
      flex-direction: column;

      .load-btn, .save-btn, .apply-btn {
        width: 100%;
      }
    }
  }

  .json-editor {
    min-height: 250px;
    font-size: 11px;
  }
}


</style>