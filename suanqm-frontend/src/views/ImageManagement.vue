<template>
  <div class="image-management">
    <div class="management-header">
      <h1>图片管理</h1>
      <div class="actions">
        <div class="status-toggle">
          <button
            @click="showBanned = true"
            class="toggle-btn"
            :class="{ active: showBanned }"
          >
            已封禁
          </button>
          <button
            @click="showBanned = false"
            class="toggle-btn"
            :class="{ active: !showBanned }"
          >
            未封禁
          </button>
        </div>
        <button
          v-if="showBanned"
          @click="toggleBlur"
          class="blur-toggle-btn"
          :class="{ active: blurEnabled }"
        >
          {{ blurEnabled ? '🔓 清除模糊' : '🌫️ 模糊显示' }}
        </button>
        <div class="search-box">
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索图片..."
            class="search-input"
            @input="handleSearch"
          />
          <button @click="clearSearch" class="clear-search-btn">✕</button>
        </div>
        <button @click="loadImages" class="refresh-btn" :disabled="loading">
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

    <div v-else-if="images.length === 0" class="empty-state">
      <span class="empty-icon">🖼️</span>
      <span class="empty-text">{{ showBanned ? '暂无被禁止的图片' : '暂无未封禁的图片' }}</span>
    </div>

    <div v-else class="content">
      <div class="images-grid">
        <div
          v-for="image in images"
          :key="image.id"
          class="image-card"
          :class="{ blurred: blurEnabled && showBanned }"
          @click="viewImageDetail(image)"
        >
          <div class="image-preview">
            <img :src="image.url" :alt="image.md5" class="image-thumb" />
            <div class="image-overlay">
              <span class="view-icon">查看...</span>
            </div>
          </div>
          <div class="image-info">
            <div class="image-md5">{{ formatMd5(image.md5) }}</div>
            <div class="image-size">{{ formatSize(image.size) }}</div>
            <div v-if="image.reason" class="image-reason">{{ image.reason }}</div>
          </div>
        </div>
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

    <div v-if="selectedImage" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>图片详情</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-image">
            <img :src="selectedImage.url" :alt="selectedImage.md5" class="detail-img" />
          </div>
          <div class="detail-info">
            <div class="info-item">
              <span class="info-label">MD5</span>
              <span class="info-value">{{ selectedImage.md5 }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">文件大小</span>
              <span class="info-value">{{ formatSize(selectedImage.size) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">禁止原因</span>
              <span class="info-value">{{ selectedImage.reason || '无' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">状态</span>
              <span class="info-value" :class="{ banned: selectedImage.banned }">
                {{ selectedImage.banned ? '已封禁' : '未封禁' }}
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button
            v-if="!selectedImage.banned"
            @click="banImage(selectedImage.id)"
            class="action-btn ban-btn"
            :disabled="actionLoading"
          >
            🚫 封禁图片
          </button>
          <button
            v-if="selectedImage.banned"
            @click="unbanImage(selectedImage.id)"
            class="action-btn unban-btn"
            :disabled="actionLoading"
          >
            🔄 解禁图片
          </button>
          <button
            @click="deleteImage(selectedImage.id)"
            class="action-btn delete-btn"
            :disabled="actionLoading"
          >
            🗑️ 删除图片
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { imageApi } from '../api'
import type { BannedImage } from '../types/api'

const images = ref<BannedImage[]>([])
const loading = ref(false)
const loadError = ref('')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(12)
const totalPages = ref(0)
const total = ref(0)
const selectedImage = ref<BannedImage | null>(null)
const actionLoading = ref(false)
const showBanned = ref(true)
const blurEnabled = ref(true)

async function loadImages() {
  loading.value = true
  loadError.value = ''
  try {
    const response = showBanned.value
      ? await imageApi.getBannedImages({
          page: currentPage.value,
          pageSize: pageSize.value
        })
      : await imageApi.getUnbannedImages({
          page: currentPage.value,
          pageSize: pageSize.value
        })
    
    if (response.code === 200) {
      images.value = response.data
      total.value = response.pagination?.total || 0
      totalPages.value = response.pagination?.totalPages || 0
    } else {
      loadError.value = response.message || '加载图片失败'
    }
  } catch (error) {
    console.error('加载图片失败:', error)
    loadError.value = '加载图片失败，请检查后台服务是否启动'
  } finally {
    loading.value = false
  }
}

function formatMd5(md5: string): string {
  return md5.length > 16 ? md5.substring(0, 16) + '...' : md5
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

function handleSearch() {
  currentPage.value = 1
  loadImages()
}

function clearSearch() {
  searchKeyword.value = ''
  currentPage.value = 1
  loadImages()
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadImages()
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    loadImages()
  }
}

function viewImageDetail(image: BannedImage) {
  selectedImage.value = image
}

function closeModal() {
  selectedImage.value = null
}

function toggleBlur() {
  blurEnabled.value = !blurEnabled.value
}

async function banImage(imageId: number) {
  const reason = prompt('请输入封禁原因：', '违规内容')
  if (!reason) return
  
  actionLoading.value = true
  try {
    const response = await imageApi.banImage(imageId, reason)
    if (response.code === 200) {
      const index = images.value.findIndex(img => img.id === imageId)
      if (index !== -1) {
        images.value[index] = response.data
      }
      selectedImage.value = response.data
    }
  } catch (error) {
    console.error('封禁图片失败:', error)
    alert('封禁图片失败，请重试')
  } finally {
    actionLoading.value = false
  }
}

async function unbanImage(imageId: number) {
  actionLoading.value = true
  try {
    const response = await imageApi.unbanImage(imageId)
    if (response.code === 200) {
      const index = images.value.findIndex(img => img.id === imageId)
      if (index !== -1) {
        images.value[index] = response.data
      }
      selectedImage.value = response.data
    }
  } catch (error) {
    console.error('解禁图片失败:', error)
    alert('解禁图片失败，请重试')
  } finally {
    actionLoading.value = false
  }
}

async function deleteImage(imageId: number) {
  if (!confirm('确定要删除这张图片吗？')) {
    return
  }
  
  actionLoading.value = true
  try {
    const response = await imageApi.deleteImage(imageId)
    if (response.code === 200) {
      images.value = images.value.filter(img => img.id !== imageId)
      closeModal()
    }
  } catch (error) {
    console.error('删除图片失败:', error)
    alert('删除图片失败，请重试')
  } finally {
    actionLoading.value = false
  }
}

watch(showBanned, () => {
  currentPage.value = 1
  loadImages()
})

onMounted(() => {
  loadImages()
})
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.image-management {
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

  .status-toggle {
    display: flex;
    background: $color-bg-secondary;
    border-radius: $radius-md;
    padding: 4px;
    gap: 4px;
  }

  .toggle-btn {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: $radius-sm;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all $transition-base;
    color: $color-text-secondary;

    &:hover {
      color: $color-text-primary;
    }

    &.active {
      background: $color-secondary;
      color: $color-text-white;
    }
  }

  .search-box {
    display: flex;
    align-items: center;
    position: relative;

    .search-input {
      padding: 8px 12px;
      padding-right: 30px;
      border: 1px solid $color-border;
      border-radius: $radius-md;
      font-size: 14px;
      width: 200px;
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

  .blur-toggle-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    cursor: pointer;
    font-size: 14px;
    transition: all $transition-base;
    color: $color-text-secondary;

    &:hover {
      background: $color-bg-secondary;
      color: $color-text-primary;
      border-color: $color-secondary;
    }

    &.active {
      background: $color-secondary;
      color: $color-text-white;
      border-color: $color-secondary;
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

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.image-card {
  background: $color-bg-secondary;
  border-radius: $radius-lg;
  overflow: hidden;
  box-shadow: $shadow-md;
  transition: all $transition-base;
  cursor: pointer;

  &:hover {
    box-shadow: $shadow-lg;
    transform: translateY(-4px);

    .image-overlay {
      opacity: 1;
    }
  }

  &.blurred {
    .image-thumb {
      filter: blur(10px);
    }
  }
}

.image-preview {
  position: relative;
  width: 100%;
  padding-top: 75%;
  background: $color-bg-dark;
  overflow: hidden;

  .image-thumb {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity $transition-base;

    .view-icon {
      font-size: 32px;
      color: $color-text-white;
    }
  }
}

.image-info {
  padding: 12px;

  .image-md5 {
    font-size: 12px;
    color: $color-text-secondary;
    margin-bottom: 4px;
    font-family: monospace;
  }

  .image-size {
    font-size: 13px;
    color: $color-text-primary;
    margin-bottom: 4px;
    font-weight: 500;
  }

  .image-reason {
    font-size: 12px;
    color: $color-danger;
    font-weight: 500;
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
  max-width: 600px;
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

.detail-image {
  margin-bottom: 20px;
  text-align: center;

  .detail-img {
    max-width: 100%;
    max-height: 400px;
    object-fit: contain;
    border-radius: $radius-md;
  }
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid $color-border-light;

    &:last-child {
      border-bottom: none;
    }

    .info-label {
      font-size: 14px;
      color: $color-text-secondary;
      font-weight: 500;
    }

    .info-value {
      font-size: 14px;
      color: $color-text-primary;
      font-weight: 600;
      text-align: right;
      max-width: 60%;
      word-break: break-all;

      &.banned {
        color: $color-danger;
      }
    }
  }
}

.modal-footer {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid $color-border;
  justify-content: flex-end;
  flex-wrap: wrap;

  .action-btn {
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

  .ban-btn {
    background: $color-danger;
    color: $color-text-white;
    border: 1px solid $color-danger;

    &:hover:not(:disabled) {
      background: #c0392b;
    }
  }

  .unban-btn {
    background: $color-success;
    color: $color-text-white;
    border: 1px solid $color-success;

    &:hover:not(:disabled) {
      background: #219150;
    }
  }

  .delete-btn {
    background: $color-text-secondary;
    color: $color-text-white;
    border: 1px solid $color-text-secondary;

    &:hover:not(:disabled) {
      background: $color-text-primary;
    }
  }
}

@media (max-width: 768px) {
  .image-management {
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

      .status-toggle {
        width: 100%;
      }

      .search-box {
        .search-input {
          width: 100%;
        }
      }

      .refresh-btn {
        width: 100%;
      }
    }
  }

  .images-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .image-info {
    padding: 10px;

    .image-md5 {
      font-size: 11px;
    }

    .image-size {
      font-size: 12px;
    }

    .image-reason {
      font-size: 11px;
    }
  }

  .modal-content {
    max-width: 90%;
  }

  .detail-info {
    .info-item {
      flex-direction: column;
      gap: 4px;

      .info-value {
        text-align: left;
        max-width: 100%;
      }
    }
  }

  .modal-footer {
    flex-direction: column;

    .action-btn {
      width: 100%;
    }
  }
}

@media (max-width: 480px) {
  .images-grid {
    grid-template-columns: 1fr;
  }

  .pagination {
    flex-direction: column;
    gap: 8px;

    .pagination-btn {
      width: 100%;
    }
  }
}
</style>
