# Command Log API

## 基础信息

- 基础路径: `/api/command-logs`
- 认证方式: Bearer Token (需在请求头中携带 `Authorization: Bearer <token>`)
- 所有接口均需要管理员权限

---

## 接口列表

### 1. 查询命令日志列表

**GET** `/api/command-logs`

查询命令执行日志，支持多种筛选条件。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认50，最大200 |
| groupId | number | 否 | 群组ID筛选 |
| userId | number | 否 | 用户ID筛选 |
| command | string | 否 | 命令名称筛选 |
| isCoAdmin | boolean | 否 | 是否协管执行 |
| success | boolean | 否 | 是否成功 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取命令日志成功",
  "data": [
    {
      "id": 1,
      "user_id": 2426208942,
      "group_id": 1079088565,
      "command": "ban",
      "params": "{\"userId\":3491395670,\"duration\":300}",
      "is_co_admin": true,
      "ruling_cost": 5,
      "target_user_id": 3491395670,
      "auth_level": "admin",
      "success": true,
      "error_message": null,
      "reason": null,
      "created_at": "2026-07-20 12:10:30.575390"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

### 2. 查询单条命令日志

**GET** `/api/command-logs/:id`

根据日志ID查询详细信息。

**请求参数（Path）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 日志ID |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取日志成功",
  "data": {
    "id": 1,
    "user_id": 2426208942,
    "group_id": 1079088565,
    "command": "ban",
    "params": "{\"userId\":3491395670,\"duration\":300}",
    "is_co_admin": true,
    "ruling_cost": 5,
    "target_user_id": 3491395670,
    "auth_level": "admin",
    "success": true,
    "error_message": null,
    "reason": null,
    "created_at": "2026-07-20 12:10:30.575390"
  }
}
```

---

### 3. 查询命令统计

**GET** `/api/command-logs/stats/by-command`

按命令名称统计调用次数。

**响应示例：**

```json
{
  "code": 200,
  "message": "获取命令统计成功",
  "data": {
    "ban": 50,
    "recall": 30,
    "verify": 20,
    "credit": 100
  }
}
```

---

### 4. 查询用户统计

**GET** `/api/command-logs/stats/by-user`

按用户统计命令调用次数。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| groupId | number | 否 | 群组ID筛选 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取用户统计成功",
  "data": [
    { "user_id": 2426208942, "count": 50 },
    { "user_id": 123456789, "count": 30 }
  ]
}
```

---

### 5. 查询协管统计

**GET** `/api/command-logs/stats/co-admin`

统计协管裁决点消耗情况。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| groupId | number | 否 | 群组ID筛选 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取协管统计成功",
  "data": [
    { "user_id": 2426208942, "total_cost": 100, "count": 20 },
    { "user_id": 123456789, "total_cost": 50, "count": 10 }
  ]
}
```

---

### 6. 查询协管命令日志

**GET** `/api/command-logs/co-admin`

查询所有协管执行的命令日志。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认50，最大200 |
| groupId | number | 否 | 群组ID筛选 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取协管命令日志成功",
  "data": [...],
  "pagination": {...}
}
```

---

### 7. 查询失败命令日志

**GET** `/api/command-logs/failed`

查询所有执行失败的命令日志。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页数量，默认50，最大200 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取失败命令日志成功",
  "data": [...],
  "pagination": {...}
}
```

---

### 8. 添加日志原因

**POST** `/api/command-logs/:id/reason`

为指定日志记录添加原因说明。

**请求参数（Path）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | number | 是 | 日志ID |

**请求体（JSON）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reason | string | 是 | 原因说明 |

**响应示例：**

```json
{
  "code": 200,
  "message": "添加原因成功",
  "data": {
    "id": 1,
    "reason": "测试用例",
    ...
  }
}
```

---

### 9. 删除旧日志

**DELETE** `/api/command-logs/old`

删除指定天数前的日志记录。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| days | number | 否 | 天数，默认30天 |

**响应示例：**

```json
{
  "code": 200,
  "message": "已删除30天前的日志",
  "data": null
}
```

---

## 数据结构

### CommandLog

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 主键ID |
| user_id | bigint | 执行命令的用户ID |
| group_id | bigint | 群组ID（私聊为null） |
| command | string | 命令名称 |
| params | text | 参数JSON字符串 |
| is_co_admin | boolean | 是否协管执行 |
| ruling_cost | int | 裁决点消耗（协管） |
| target_user_id | bigint | 目标用户ID |
| auth_level | string | 权限等级要求 |
| success | boolean | 是否执行成功 |
| error_message | text | 错误信息 |
| reason | text | 原因说明 |
| created_at | datetime | 创建时间 |

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权或Token无效 |
| 404 | 日志记录不存在 |
| 500 | 服务器内部错误 |

---

# Statistics API

## 基础信息

- 基础路径: `/api/statistics`
- 认证方式: Bearer Token (需在请求头中携带 `Authorization: Bearer <token>`)
- 所有接口均需要管理员权限

---

## 接口列表

### 1. 获取消息趋势

**GET** `/api/statistics/message-trend`

获取消息数量趋势统计，支持按天、周、月统计。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | 统计周期，可选值: `day` / `week` / `month` |
| count | number | 是 | 返回数量，必须是正整数 |
| groupId | number | 否 | 指定群ID，不指定则统计所有群 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取消息趋势成功",
  "data": [
    { "period": "2026-07-15", "count": 120 },
    { "period": "2026-07-16", "count": 150 },
    { "period": "2026-07-17", "count": 130 }
  ]
}
```

---

### 2. 获取用户消息排行榜

**GET** `/api/statistics/user-ranking`

获取发送消息最多的用户排行榜。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回数量限制，默认10 |
| groupId | number | 否 | 指定群ID，不指定则统计所有群 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取用户消息排行榜成功",
  "data": [
    { "user_id": 2426208942, "nickname": "小酸酸", "count": 500 },
    { "user_id": 123456789, "nickname": "用户二", "count": 300 }
  ]
}
```

---

### 3. 获取消息时间分布

**GET** `/api/statistics/hourly-distribution`

获取24小时消息分布统计。

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| groupId | number | 否 | 指定群ID，不指定则统计所有群 |

**响应示例：**

```json
{
  "code": 200,
  "message": "获取消息时间分布成功",
  "data": [
    { "hour": 0, "count": 10 },
    { "hour": 1, "count": 5 },
    { "hour": 9, "count": 100 },
    { "hour": 20, "count": 200 }
  ]
}
```

---

### 4. 获取所有群列表

**GET** `/api/statistics/groups`

获取机器人加入的所有群列表。

**响应示例：**

```json
{
  "code": 200,
  "message": "获取群列表成功",
  "data": [
    { "group_id": 1079088565, "name": "测试群", "member_count": 100 },
    { "group_id": 987654321, "name": "开发群", "member_count": 50 }
  ]
}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误（period/count格式错误等） |
| 401 | 未授权或Token无效 |
| 500 | 服务器内部错误 |