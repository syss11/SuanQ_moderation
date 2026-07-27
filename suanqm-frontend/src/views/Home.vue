<template>
  <div class="home">
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="loadError" class="error-state">
      <span class="error-icon">❌</span>
      <span class="error-text">{{ loadError }}</span>
    </div>
    
    <div v-else class="content">
      <div v-if="selfInfo" class="robot-info">
        <div class="info-header">机器人信息</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">QQ 号</span>
            <span class="info-value">{{ selfInfo.self_id }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">昵称</span>
            <span class="info-value">{{ selfInfo.nickname }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">头像</span>
            <img :src="selfInfo.avatar_url" class="avatar" alt="头像" />
          </div>
        </div>
      </div>

      <div v-if="systemInfo" class="system-cards">
        <div class="info-header">系统信息</div>
        <div class="cards-grid">
          <div class="info-card">
            <div class="card-title">系统</div>
            <div class="card-content">
              <div class="card-item">
                <span class="card-label">平台</span>
                <span class="card-value">{{ systemInfo.system.platform }}</span>
              </div>
              <div class="card-item">
                <span class="card-label">架构</span>
                <span class="card-value">{{ systemInfo.system.arch }}</span>
              </div>
              <div class="card-item">
                <span class="card-label">主机名</span>
                <span class="card-value">{{ systemInfo.system.hostname }}</span>
              </div>
              <div class="card-item">
                <span class="card-label">系统类型</span>
                <span class="card-value">{{ systemInfo.system.type }}</span>
              </div>
              <div class="card-item">
                <span class="card-label">版本</span>
                <span class="card-value">{{ systemInfo.system.release }}</span>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="card-title">内存</div>
            <div class="card-content">
              <div class="memory-info">
                <div class="memory-item">
                  <span class="memory-label">总计</span>
                  <span class="memory-value">{{ systemInfo.memory.totalGB }} GB</span>
                </div>
                <div class="memory-item">
                  <span class="memory-label">已用</span>
                  <span class="memory-value">{{ systemInfo.memory.usedGB }} GB</span>
                </div>
                <div class="memory-item">
                  <span class="memory-label">空闲</span>
                  <span class="memory-value">{{ systemInfo.memory.freeGB }} GB</span>
                </div>
              </div>
              <div class="progress-container">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: systemInfo.memory.usagePercent }"></div>
                </div>
                <span class="progress-text">{{ systemInfo.memory.usagePercent }}</span>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="card-title">CPU</div>
            <div class="card-content">
              <div class="cpu-info">
                <div class="cpu-item">
                  <span class="cpu-label">1分钟</span>
                  <span class="cpu-value">{{ systemInfo?.cpu?.loadAverage?.[0]?.toFixed(2) }}</span>
                </div>
                <div class="cpu-item">
                  <span class="cpu-label">5分钟</span>
                  <span class="cpu-value">{{ systemInfo?.cpu?.loadAverage?.[1]?.toFixed(2) }}</span>
                </div>
                <div class="cpu-item">
                  <span class="cpu-label">15分钟</span>
                  <span class="cpu-value">{{ systemInfo?.cpu?.loadAverage?.[2]?.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="card-title">时间</div>
            <div class="card-content">
              <div class="card-item">
                <span class="card-label">当前时间</span>
                <span class="card-value">{{ formatTime(systemInfo.time.currentTime) }}</span>
              </div>
              <div class="card-item">
                <span class="card-label">时区</span>
                <span class="card-value">{{ systemInfo.time.timezone }}</span>
              </div>
            </div>
          </div>

          <div class="info-card">
            <div class="card-title">WebSocket</div>
            <div class="card-content">
              <div class="card-item">
                <span class="card-label">状态</span>
                <span class="card-value" :class="{ 'status-active': systemInfo.websocket.status === 'active' }">
                  {{ systemInfo.websocket.status === 'active' ? '活跃' : '未活跃' }}
                </span>
              </div>
              <div class="card-item">
                <span class="card-label">连接数</span>
                <span class="card-value">{{ systemInfo.websocket.connected }}</span>
              </div>
              <div class="card-item">
                <span class="card-label">已认证</span>
                <span class="card-value">{{ systemInfo.websocket.authenticated }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="statisticsLoaded" class="statistics-section">
        <div class="info-header">数据统计</div>
        
        <div class="stats-scroll">
          <div class="stats-cards">
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-content">
                <div class="stat-label">总消息数</div>
                <div class="stat-value">{{ totalMessages }}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">👥</div>
              <div class="stat-content">
                <div class="stat-label">活跃群数</div>
                <div class="stat-value">{{ groups.length }}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">👤</div>
              <div class="stat-content">
                <div class="stat-label">活跃用户数</div>
                <div class="stat-value">{{ userRanking.length }}</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">👨‍👩‍👧‍👦</div>
              <div class="stat-content">
                <div class="stat-label">群成员总数</div>
                <div class="stat-value">{{ totalMembers }}</div>
              </div>
            </div>
          </div>

          <div class="stats-detail-grid">
            <div class="info-card">
              <div class="card-title">消息趋势</div>
              <div class="card-content">
                <div class="trend-chart">
                  <div 
                    v-for="item in messageTrend" 
                    :key="item.date"
                    class="trend-bar-container"
                  >
                    <span class="trend-count">{{ item.count }}</span>
                    <div 
                      class="trend-bar"
                      :style="{ height: getTrendBarHeight(item.count) + '%' }"
                      :title="item.count + ' 条消息'"
                    ></div>
                    <span class="trend-label">{{ formatTrendLabel(item.date) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-title">用户消息排行</div>
              <div class="card-content">
                <div class="ranking-list">
                  <div 
                    v-for="(item, index) in userRanking" 
                    :key="item.user_id"
                    class="ranking-item"
                  >
                    <span class="rank-badge" :class="getRankClass(index)">{{ index + 1 }}</span>
                    <span class="rank-nickname">{{ item.nickname }}</span>
                    <span class="rank-count">{{ item.count }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-title">消息时间分布</div>
              <div class="card-content">
                <div class="hourly-chart">
                  <div 
                    v-for="item in hourlyDistribution" 
                    :key="item.hour"
                    class="hourly-bar-container"
                  >
                    <div 
                      class="hourly-bar"
                      :style="{ height: getHourlyBarHeight(item.count) + '%' }"
                      :title="item.hour + ':00 - ' + item.count + ' 条'"
                    ></div>
                    <span class="hourly-label">{{ item.hour }}h</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="info-card">
              <div class="card-title">群列表</div>
              <div class="card-content">
                <div class="group-list">
                  <div 
                    v-for="group in groups" 
                    :key="group.group_id"
                    class="group-item"
                  >
                    <span class="group-name">{{ group.name }}</span>
                    <span class="group-count">{{ group.member_count }} 成员</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { systemApi, statisticsApi } from '../api'
import type { SelfInfo, SystemInfo, MessageTrendItem, UserRankingItem, HourlyDistributionItem, GroupInfo } from '../types/api'

const selfInfo = ref<SelfInfo | null>(null)
const systemInfo = ref<SystemInfo | null>(null)
const messageTrend = ref<MessageTrendItem[]>([])
const userRanking = ref<UserRankingItem[]>([])
const hourlyDistribution = ref<HourlyDistributionItem[]>([])
const groups = ref<GroupInfo[]>([])
const statisticsLoaded = ref(false)
const loading = ref(false)
const loadError = ref('')

const totalMessages = computed(() => {
  return messageTrend.value.reduce((sum, item) => sum + item.count, 0)
})

const totalMembers = computed(() => {
  return groups.value.reduce((sum, group) => sum + group.member_count, 0)
})

const maxTrendCount = computed(() => {
  const counts = messageTrend.value.map(item => item.count)
  return counts.length > 0 ? Math.max(...counts) : 1
})

const maxHourlyCount = computed(() => {
  const counts = hourlyDistribution.value.map(item => item.count)
  return counts.length > 0 ? Math.max(...counts) : 1
})

function formatTime(timeStr: string) {
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatTrendLabel(period?: string) {
  if (!period) return ''
  if (period.includes('-')) {
    const parts = period.split('-')
    return `${parts[1]}/${parts[2]}`
  }
  return period
}

function getTrendBarHeight(count: number) {
  return Math.max(5, (count / maxTrendCount.value) * 100)
}

function getHourlyBarHeight(count: number) {
  return Math.max(5, (count / maxHourlyCount.value) * 100)
}

function getRankClass(index: number) {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return ''
}

async function fetchData() {
  loading.value = true
  loadError.value = ''
  try {
    const [selfRes, systemRes, trendRes, rankingRes, hourlyRes, groupsRes] = await Promise.all([
      systemApi.getSelfId(),
      systemApi.getSystemInfo(),
      statisticsApi.getMessageTrend('day', 7),
      statisticsApi.getUserRanking(10),
      statisticsApi.getHourlyDistribution(),
      statisticsApi.getGroups()
    ])

    if (selfRes.code === 200) {
      selfInfo.value = selfRes.data
    } else {
      loadError.value = selfRes.message || '获取机器人信息失败'
    }

    if (systemRes.code === 200) {
      systemInfo.value = systemRes.data
    } else {
      loadError.value = systemRes.message || '获取系统信息失败'
    }

    if (trendRes.code === 200) {
      messageTrend.value = trendRes.data
    }

    if (rankingRes.code === 200) {
      userRanking.value = rankingRes.data
    }

    if (hourlyRes.code === 200) {
      hourlyDistribution.value = hourlyRes.data
    }

    if (groupsRes.code === 200) {
      groups.value = groupsRes.data
    }

    statisticsLoaded.value = true
  } catch (error) {
    console.error('获取数据失败:', error)
    loadError.value = '加载数据失败，请检查后台服务是否启动'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="scss">
@use "../styles/variables.scss" as *;

.home {
  padding: 0;

  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 400px;
    font-size: 18px;
    color: $color-text-secondary;
  }

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
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

  .content {
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  .info-header {
    font-size: 20px;
    font-weight: 600;
    color: $color-text-primary;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid $color-secondary;
  }

  .robot-info {
    background: $color-bg-secondary;
    padding: 30px;
    border-radius: $radius-lg;
    box-shadow: $shadow-md;

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .info-label {
          font-size: 14px;
          color: $color-text-secondary;
          font-weight: 500;
        }

        .info-value {
          font-size: 16px;
          color: $color-text-primary;
          font-weight: 600;
        }

        .avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
        }
      }
    }
  }

  .statistics-section {
    .stats-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: $color-bg-secondary;
      padding: 24px;
      border-radius: $radius-lg;
      box-shadow: $shadow-md;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all $transition-base;

      &:hover {
        box-shadow: $shadow-lg;
        transform: translateY(-2px);
      }

      .stat-icon {
        font-size: 32px;
      }

      .stat-content {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .stat-label {
          font-size: 14px;
          color: $color-text-secondary;
          font-weight: 500;
        }

        .stat-value {
          font-size: 24px;
          color: $color-secondary;
          font-weight: 700;
        }
      }
    }

    .stats-detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
    }
  }

  .system-cards {
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
  }

  .info-card {
    background: $color-bg-secondary;
    padding: 24px;
    border-radius: $radius-lg;
    box-shadow: $shadow-md;
    transition: all $transition-base;

    &:hover {
      box-shadow: $shadow-lg;
      transform: translateY(-2px);
    }

    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: $color-secondary;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid $color-border;
    }

    .card-content {
      .card-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid $color-border-light;

        &:last-child {
          border-bottom: none;
        }

        .card-label {
          font-size: 14px;
          color: $color-text-secondary;
          font-weight: 500;
        }

        .card-value {
          font-size: 16px;
          color: $color-text-primary;
          font-weight: 600;

          &.status-active {
            color: $color-success;
          }
        }
      }

      .memory-info {
        .memory-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;

          .memory-label {
            font-size: 14px;
            color: $color-text-secondary;
          }

          .memory-value {
            font-size: 16px;
            color: $color-text-primary;
            font-weight: 600;
          }
        }
      }

      .progress-container {
        margin-top: 20px;

        .progress-bar {
          width: 100%;
          height: 24px;
          background: $color-bg-dark;
          border-radius: $radius-md;
          overflow: hidden;

          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, $color-secondary 0%, $color-purple-dark 100%);
            transition: width $transition-slow;
            border-radius: $radius-md;
          }
        }

        .progress-text {
          display: block;
          text-align: center;
          margin-top: 8px;
          font-size: 14px;
          color: $color-text-secondary;
          font-weight: 500;
        }
      }

      .cpu-info {
        .cpu-item {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid $color-border-light;

          &:last-child {
            border-bottom: none;
          }

          .cpu-label {
            font-size: 14px;
            color: $color-text-secondary;
          }

          .cpu-value {
            font-size: 16px;
            color: $color-text-primary;
            font-weight: 600;
          }
        }
      }

      .trend-chart {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        height: 150px;
        padding: 10px 0;

        .trend-bar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          height: 100%;

          .trend-bar {
            width: 24px;
            background: $color-secondary;
            border-radius: 4px 4px 0 0;
            transition: height $transition-base;
            min-height: 8px;
          }

          .trend-count {
            font-size: 12px;
            font-weight: 600;
            color: $color-text-primary;
            margin-bottom: 4px;
          }

          .trend-label {
            font-size: 11px;
            color: $color-text-secondary;
            margin-top: 8px;
            white-space: nowrap;
          }
        }
      }

      .ranking-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 200px;
        overflow-y: auto;

        .ranking-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: $color-bg-dark;
          border-radius: $radius-md;

          .rank-badge {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: $color-border;
            border-radius: 50%;
            font-size: 12px;
            font-weight: 600;
            color: $color-text-secondary;

            &.rank-gold {
              background: linear-gradient(135deg, #FFD700, #FFA500);
              color: #fff;
            }

            &.rank-silver {
              background: linear-gradient(135deg, #C0C0C0, #A0A0A0);
              color: #fff;
            }

            &.rank-bronze {
              background: linear-gradient(135deg, #CD7F32, #B87333);
              color: #fff;
            }
          }

          .rank-nickname {
            flex: 1;
            font-size: 14px;
            color: $color-text-primary;
            font-weight: 500;
          }

          .rank-count {
            font-size: 16px;
            color: $color-secondary;
            font-weight: 700;
          }
        }
      }

      .hourly-chart {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        height: 120px;
        padding: 10px 0;
        flex-wrap: wrap;

        .hourly-bar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 36px;
          height: 100%;

          .hourly-bar {
            width: 16px;
            background: linear-gradient(180deg, $color-purple-light 0%, $color-purple-dark 100%);
            border-radius: 3px 3px 0 0;
            transition: height $transition-base;
            min-height: 4px;
          }

          .hourly-label {
            font-size: 10px;
            color: $color-text-secondary;
            margin-top: 4px;
          }
        }
      }

      .group-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 200px;
        overflow-y: auto;

        .group-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: $color-bg-dark;
          border-radius: $radius-md;

          .group-name {
            font-size: 14px;
            color: $color-text-primary;
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 200px;
          }

          .group-count {
            font-size: 13px;
            color: $color-text-secondary;
            font-weight: 500;
          }
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .home {
    .content {
      gap: 20px;
    }

    .info-header {
      font-size: 18px;
      margin-bottom: 16px;
    }

    .robot-info {
      padding: 20px;

      .info-grid {
        grid-template-columns: 1fr;
        gap: 16px;

        .info-item {
          .avatar {
            width: 60px;
            height: 60px;
          }
        }
      }
    }

    .statistics-section {
      .stats-cards {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }

      .stat-card {
        padding: 16px;

        .stat-icon {
          font-size: 24px;
        }

        .stat-content .stat-value {
          font-size: 20px;
        }
      }

      .stats-detail-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }

    .system-cards {
      .cards-grid {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }

    .info-card {
      padding: 16px;

      .card-title {
        font-size: 16px;
        margin-bottom: 16px;
      }

      .card-content {
        .card-item {
          padding: 10px 0;

          .card-label {
            font-size: 12px;
          }

          .card-value {
            font-size: 14px;
          }
        }

        .memory-info {
          .memory-item {
            padding: 6px 0;

            .memory-label {
              font-size: 12px;
            }

            .memory-value {
              font-size: 14px;
            }
          }
        }

        .cpu-info {
          .cpu-item {
            padding: 10px 0;

            .cpu-label {
              font-size: 12px;
            }

            .cpu-value {
              font-size: 14px;
            }
          }
        }

        .trend-chart {
          .trend-bar-container .trend-bar {
            width: 16px;
          }

          .trend-label {
            font-size: 9px;
          }
        }

        .hourly-chart {
          .hourly-bar-container {
            width: 28px;

            .hourly-bar {
              width: 12px;
            }

            .hourly-label {
              font-size: 8px;
            }
          }
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .home {
    .info-header {
      font-size: 16px;
    }

    .robot-info {
      padding: 16px;

      .info-grid {
        gap: 12px;
      }
    }

    .statistics-section {
      .stats-cards {
        grid-template-columns: 1fr;
      }
    }

    .system-cards {
      .cards-grid {
        gap: 12px;
      }
    }

    .info-card {
      padding: 12px;
    }
  }
}
</style>