# WebSocket API 文档

## 概述

本WebSocket服务用于实时接收服务器日志推送和进行双向通信。所有WebSocket连接都需要通过JWT认证才能接收日志消息。

## 连接地址

```
ws://localhost:6065/ws
```

## 认证方式

### 方式一：URL参数携带Token（推荐）

在连接时通过URL参数传递JWT token：

```javascript
const ws = new WebSocket('ws://localhost:6065/ws?token=your_jwt_token');
```

### 方式二：连接后发送认证消息

连接成功后发送`auth`类型的消息：

```javascript
const ws = new WebSocket('ws://localhost:6065/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    data: { token: 'your_jwt_token' }
  }));
};
```

## 获取JWT Token

首先通过HTTP API获取JWT token：

```bash
POST /api/auth/login
Content-Type: application/json

{
  "password": "your_password"
}
```

响应：
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

## 消息格式

所有消息都采用JSON格式：

```json
{
  "type": "消息类型",
  "data": { /* 数据对象 */ },
  "timestamp": 1704067200000
}
```

## 服务器发送的消息类型

### 1. connected - 连接建立

连接成功后服务器会立即发送此消息：

```json
{
  "type": "connected",
  "data": {
    "message": "WebSocket连接已建立且认证成功",
    "authenticated": true,
    "timestamp": 1704067200000
  },
  "timestamp": 1704067200000
}
```

字段说明：
- `authenticated`: `true`表示已通过认证，`false`表示需要认证

### 2. auth_success - 认证成功

当认证成功时发送：

```json
{
  "type": "auth_success",
  "data": {
    "message": "认证成功",
    "userId": "1234567890",
    "timestamp": 1704067200000
  },
  "timestamp": 1704067200000
}
```

### 3. auth_failed - 认证失败

当认证失败时发送：

```json
{
  "type": "auth_failed",
  "data": {
    "message": "认证失败，令牌无效或已过期",
    "timestamp": 1704067200000
  },
  "timestamp": 1704067200000
}
```

### 4. logs - 日志批量推送（防抖）

服务器使用防抖机制批量推送日志（100ms内的日志会合并发送）：

```json
{
  "type": "logs",
  "data": [
    {
      "level": "INFO",
      "message": "WebSocket客户端连接: ::1, 当前连接数: 1",
      "timestamp": "2024-01-01T00:00:00.000Z",
      "prefix": ""
    },
    {
      "level": "DEBUG",
      "message": "调试信息",
      "timestamp": "2024-01-01T00:00:00.001Z",
      "prefix": "[Napcat]"
    }
  ],
  "timestamp": 1704067200000
}
```

日志级别：
- `DEBUG`: 调试信息
- `INFO`: 一般信息
- `WARN`: 警告信息
- `ERROR`: 错误信息
- `LOG`: 普通日志

### 5. pong - 心跳响应

响应客户端的ping消息：

```json
{
  "type": "pong",
  "timestamp": 1704067200000
}
```

### 6. error - 错误消息

当发生错误时发送：

```json
{
  "type": "error",
  "data": {
    "message": "未认证，请先进行认证",
    "timestamp": 1704067200000
  },
  "timestamp": 1704067200000
}
```

## 客户端发送的消息类型

### 1. auth - 认证

```json
{
  "type": "auth",
  "data": {
    "token": "your_jwt_token"
  }
}
```

### 2. ping - 心跳检测

```json
{
  "type": "ping"
}
```

### 3. 自定义消息

认证成功后可以发送自定义消息：

```json
{
  "type": "custom_message",
  "data": {
    "key": "value"
  }
}
```

## 客户端示例代码

### JavaScript 示例

```javascript
// 1. 获取JWT token
async function getToken() {
  const response = await fetch('http://localhost:6065/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      password: 'your_password'
    })
  });
  
  const result = await response.json();
  return result.data.token;
}

// 2. 连接WebSocket
async function connectWebSocket() {
  const token = await getToken();
  const ws = new WebSocket(`ws://localhost:6065/ws?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket连接已建立');
  };
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'connected':
        console.log('连接状态:', message.data.authenticated ? '已认证' : '未认证');
        break;
        
      case 'auth_success':
        console.log('认证成功，用户ID:', message.data.userId);
        break;
        
      case 'auth_failed':
        console.error('认证失败:', message.data.message);
        break;
        
      case 'logs':
        // 批量处理日志
        message.data.forEach(log => {
          console.log(`[${log.level}] ${log.message}`);
        });
        break;
        
      case 'pong':
        console.log('收到心跳响应');
        break;
        
      case 'error':
        console.error('错误:', message.data.message);
        break;
        
      default:
        console.log('未知消息类型:', message.type);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket连接已关闭');
  };
  
  // 发送心跳
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}

// 启动连接
connectWebSocket();
```

### TypeScript 示例

```typescript
interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

interface LogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'LOG';
  message: string;
  timestamp: string;
  prefix?: string;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  
  constructor(private token: string) {}
  
  connect(): void {
    this.ws = new WebSocket(`ws://localhost:6065/ws?token=${this.token}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket连接已建立');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      this.attemptReconnect();
    };
  }
  
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'logs':
        this.handleLogs(message.data as LogEntry[]);
        break;
      // 处理其他消息类型...
    }
  }
  
  private handleLogs(logs: LogEntry[]): void {
    logs.forEach(log => {
      console.log(`[${log.level}] ${log.message}`);
    });
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectDelay);
    }
  }
  
  send(type: string, data?: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }
  
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 使用示例
async function main() {
  const token = await getToken();
  const client = new WebSocketClient(token);
  client.connect();
}
```

## 心跳机制

服务器每30秒发送一次ping消息，客户端需要响应pong：

```javascript
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
  }
};
```

客户端也可以主动发送ping来检测连接状态：

```javascript
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

## 错误处理

### 常见错误

1. **未认证**
   - 原因：未提供token或token无效
   - 解决：检查token是否正确获取并传递

2. **认证失败**
   - 原因：token已过期或无效
   - 解决：重新登录获取新token

3. **连接关闭**
   - 原因：网络问题或服务器关闭
   - 解决：实现重连机制

4. **消息格式错误**
   - 原因：发送的消息不是有效的JSON
   - 解决：确保发送的消息格式正确

## 日志推送机制

- **防抖时间**: 100ms
- **批量发送**: 100ms内的所有日志会合并为一条消息发送
- **仅认证用户**: 只有通过认证的客户端才能接收日志
- **实时性**: 日志产生后立即进入缓冲区，100ms后发送

## WebSocket状态查询

可以通过HTTP API查询WebSocket连接状态：

```bash
GET /api/system/websocket-status
Authorization: Bearer your_jwt_token
```

响应：
```json
{
  "code": 200,
  "message": "获取WebSocket状态成功",
  "data": {
    "connected": 5,
    "authenticated": 3,
    "status": "active",
    "endpoint": "/ws"
  }
}
```

字段说明：
- `connected`: 当前连接总数
- `authenticated`: 已认证的连接数
- `status`: WebSocket服务器状态
- `endpoint`: WebSocket连接端点

## 注意事项

1. **Token过期**: JWT token有有效期，过期后需要重新获取
2. **连接限制**: 服务器可能有连接数限制
3. **消息大小**: 单条消息大小不应过大
4. **重连机制**: 建议客户端实现自动重连
5. **错误处理**: 妥善处理各种错误情况
6. **资源清理**: 页面关闭时记得关闭WebSocket连接

## 安全建议

1. **HTTPS**: 生产环境建议使用WSS（WebSocket Secure）
2. **Token保护**: 不要在前端代码中硬编码token
3. **验证**: 在服务端验证所有接收的消息
4. **限流**: 实现消息发送频率限制
5. **认证**: 确保所有敏感操作都需要认证