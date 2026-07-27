# 日志管理 API 文档

## 概述

日志管理 API 提供系统日志的查询、过滤、搜索和导出功能。

## 基础信息

- **Base URL**: `http://localhost:6065`
- **认证**: 所有接口需要 JWT token
- **响应格式**: JSON

## 通用响应格式

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { /* 数据对象 */ }
}
```

## 接口列表

### 1. 获取日志列表

获取系统日志列表，支持分页和过滤。

**请求**:
```http
GET /api/logs
Authorization: Bearer your_jwt_token
```

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|--------|------|
| level | string | 否 | 日志级别：DEBUG, INFO, WARN, ERROR, LOG |
| startTime | string | 否 | 开始时间（ISO 8601 格式） |
| endTime | string | 否 | 结束时间（ISO 8601 格式） |
| keyword | string | 否 | 关键词搜索 |
| limit | number | 否 | 每页数量，默认 50 |
| offset | number | 否 | 偏移量，默认 0 |

**请求示例**:
```http
GET /api/logs?level=INFO&limit=50&offset=0
```

**响应示例**:
```json
{
  "code": 200,
  "message": "获取日志成功",
  "data": [
    {
      "id": 1,
      "level": "INFO",
      "message": "系统启动成功",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "prefix": "[System]"
    },
    {
      "id": 2,
      "level": "DEBUG",
      "message": "调试信息",
      "timestamp": "2024-01-01T00:00:01.000Z",
      "prefix": "[Napcat]"
    }
  ]
}
```

### 2. 按级别获取日志

根据日志级别获取日志。

**请求**:
```http
GET /api/logs/level/{level}
Authorization: Bearer your_jwt_token
```

**路径参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|--------|------|
| level | string | 是 | 日志级别：DEBUG, INFO, WARN, ERROR, LOG |

**请求示例**:
```http
GET /api/logs/level/ERROR
```

**响应**: 同获取日志列表

### 3. 搜索日志

根据关键词搜索日志。

**请求**:
```http
GET /api/logs/search
Authorization: Bearer your_jwt_token
```

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|--------|------|
| keyword | string | 是 | 搜索关键词 |
| level | string | 否 | 日志级别 |
| startTime | string | 否 | 开始时间 |
| endTime | string | 否 | 结束时间 |
| limit | number | 否 | 每页数量 |
| offset | number | 否 | 偏移量 |

**请求示例**:
```http
GET /api/logs/search?keyword=error&level=ERROR
```

**响应**: 同获取日志列表

### 4. 导出日志

导出日志为文本文件。

**请求**:
```http
GET /api/logs/export
Authorization: Bearer your_jwt_token
```

**查询参数**: 同获取日志列表

**响应**:
- Content-Type: `text/plain`
- Content-Disposition: `attachment; filename="logs_1704067200000.txt"`

**响应示例**:
```
[2024-01-01T00:00:00.000Z] [INFO] 系统启动成功
[2024-01-01T00:00:01.000Z] [DEBUG] 调试信息
```

## 日志级别说明

| 级别 | 说明 | 颜色 | 图标 |
|------|------|------|------|
| DEBUG | 调试信息 | 蓝色 | 🔍 |
| INFO | 一般信息 | 蓝色 | ℹ️ |
| WARN | 警告信息 | 黄色 | ⚠️ |
| ERROR | 错误信息 | 红色 | ❌ |
| LOG | 普通日志 | 灰色 | 📝 |

## TypeScript 类型定义

```typescript
export interface LogEntry {
  id: number
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'LOG'
  message: string
  timestamp: string
  prefix?: string
}

export interface LogFilter {
  level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'LOG'
  startTime?: string
  endTime?: string
  keyword?: string
  limit?: number
  offset?: number
}
```

## 前端使用示例

### 1. 获取日志列表

```typescript
import { logsApi } from '@/api/logs'

async function fetchLogs() {
  const response = await logsApi.getLogs({
    level: 'INFO',
    limit: 50,
    offset: 0
  })
  
  if (response.code === 200) {
    console.log('日志列表:', response.data)
  }
}
```

### 2. 按级别过滤

```typescript
async function filterByLevel(level: string) {
  const response = await logsApi.getLogsByLevel(level)
  
  if (response.code === 200) {
    console.log('过滤后的日志:', response.data)
  }
}
```

### 3. 搜索日志

```typescript
async function searchLogs(keyword: string) {
  const response = await logsApi.searchLogs(keyword)
  
  if (response.code === 200) {
    console.log('搜索结果:', response.data)
  }
}
```

### 4. 导出日志

```typescript
async function exportLogs() {
  const blob = await logsApi.exportLogs({
    level: 'ERROR',
    startTime: '2024-01-01T00:00:00.000Z'
  })
  
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs_${Date.now()}.txt`
  a.click()
  window.URL.revokeObjectURL(url)
}
```

## 错误码

| 错误码 | 说明 |
|---------|------|
| 401 | 未认证，token 无效或已过期 |
| 403 | 权限不足 |
| 404 | 日志不存在 |
| 500 | 服务器内部错误 |

## 注意事项

1. **时间格式**: 所有时间参数使用 ISO 8601 格式（如：2024-01-01T00:00:00.000Z）
2. **分页**: 使用 `limit` 和 `offset` 实现分页加载
3. **导出限制**: 导出功能可能限制单次导出的日志数量
4. **性能**: 大量日志查询可能较慢，建议使用合适的过滤条件
5. **缓存**: 日志数据建议在前端缓存，避免重复请求
