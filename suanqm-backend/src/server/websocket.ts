import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { verifyToken } from './middleware/auth.js';
import { logger, LogEntry } from '../logger.js';

interface AuthenticatedWebSocket extends WebSocket {
  isAuthenticated: boolean;
  userId?: string;
  authTimestamp?: number;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, AuthenticatedWebSocket> = new Map();
  private authenticatedClients: Map<string, Set<WebSocket>> = new Map();
  private logBuffer: LogEntry[] = [];
  private logDebounceTimer: NodeJS.Timeout | null = null;
  private readonly LOG_DEBOUNCE_MS = 100;

  initialize(server: any): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const authWs = ws as AuthenticatedWebSocket;
      authWs.isAuthenticated = false;
      
      this.clients.set(ws, authWs);

      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      logger.log(`WebSocket客户端连接: ${req.socket.remoteAddress}, 当前连接数: ${this.clients.size}`);

      if (token) {
        this.authenticateWithToken(ws, token);
      }

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleClose(ws);
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket错误:', error);
      });

      ws.on('pong', () => {
        (ws as AuthenticatedWebSocket).isAlive = true;
      });

      if (authWs.isAuthenticated) {
        ws.send(JSON.stringify({
          type: 'connected',
          data: {
            message: 'WebSocket连接已建立且认证成功',
            authenticated: true,
            timestamp: Date.now()
          }
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'connected',
          data: {
            message: 'WebSocket连接已建立，请进行认证或在URL中携带token参数',
            authenticated: false,
            timestamp: Date.now()
          }
        }));
      }
    });

    this.wss.on('error', (error: Error) => {
      logger.error('WebSocket服务器错误:', error);
    });

    this.startHeartbeat();
    this.registerLoggerCallback();
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      const authWs = ws as AuthenticatedWebSocket;

      switch (message.type) {
        case 'auth':
          this.handleAuth(ws, message.data);
          break;
        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
        default:
          if (!authWs.isAuthenticated) {
            ws.send(JSON.stringify({
              type: 'error',
              data: {
                message: '未认证，请先进行认证',
                timestamp: Date.now()
              }
            }));
          } else {
            this.handleAuthenticatedMessage(ws, message);
          }
      }
    } catch (error) {
      logger.error('处理WebSocket消息错误:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: {
          message: '消息格式错误',
          timestamp: Date.now()
        }
      }));
    }
  }

  private handleAuth(ws: WebSocket, data: any): void {
    try {
      const { token } = data;

      if (!token) {
        ws.send(JSON.stringify({
          type: 'auth_failed',
          data: {
            message: '缺少认证令牌',
            timestamp: Date.now()
          }
        }));
        return;
      }

      this.authenticateWithToken(ws, token);
    } catch (error) {
      logger.error('WebSocket认证失败:', error);
      ws.send(JSON.stringify({
        type: 'auth_failed',
        data: {
          message: '认证失败，令牌无效或已过期',
          timestamp: Date.now()
        }
      }));
    }
  }

  private authenticateWithToken(ws: WebSocket, token: string): void {
    try {
      const decoded = verifyToken(token);
      const authWs = ws as AuthenticatedWebSocket;
      
      authWs.isAuthenticated = true;
      authWs.authTimestamp = Date.now();

      const userId = (decoded as any).timestamp?.toString() || 'unknown';
      authWs.userId = userId;

      if (!this.authenticatedClients.has(userId)) {
        this.authenticatedClients.set(userId, new Set());
      }
      this.authenticatedClients.get(userId)!.add(ws);

      logger.log(`WebSocket客户端认证成功: ${userId}`);

      ws.send(JSON.stringify({
        type: 'auth_success',
        data: {
          message: '认证成功',
          userId: userId,
          timestamp: Date.now()
        }
      }));
    } catch (error) {
      logger.error('WebSocket认证失败:', error);
      ws.send(JSON.stringify({
        type: 'auth_failed',
        data: {
          message: '认证失败，令牌无效或已过期',
          timestamp: Date.now()
        }
      }));
    }
  }

  private handleAuthenticatedMessage(ws: WebSocket, message: WebSocketMessage): void {
    logger.log(`收到认证客户端消息: ${message.type}`);
  }

  private handleClose(ws: WebSocket): void {
    const authWs = ws as AuthenticatedWebSocket;
    
    if (authWs.userId && this.authenticatedClients.has(authWs.userId)) {
      const userClients = this.authenticatedClients.get(authWs.userId)!;
      userClients.delete(ws);
      
      if (userClients.size === 0) {
        this.authenticatedClients.delete(authWs.userId);
      }
    }
    
    this.clients.delete(ws);
    logger.log(`WebSocket客户端断开连接，当前连接数: ${this.clients.size}`);
  }

  private startHeartbeat(): void {
    if (!this.wss) return;

    const interval = setInterval(() => {
      this.wss!.clients.forEach((ws: WebSocket) => {
        const authWs = ws as any;
        
        if (authWs.isAlive === false) {
          ws.terminate();
          return;
        }
        
        authWs.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  private registerLoggerCallback(): void {
    logger.registerLogCallback((entry: LogEntry) => {
      this.bufferLog(entry);
    });
  }

  private bufferLog(entry: LogEntry): void {
    this.logBuffer.push(entry);

    if (this.logDebounceTimer) {
      clearTimeout(this.logDebounceTimer);
    }

    this.logDebounceTimer = setTimeout(() => {
      this.flushLogBuffer();
    }, this.LOG_DEBOUNCE_MS);
  }

  private flushLogBuffer(): void {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    const message = {
      type: 'logs',
      data: logsToSend,
      timestamp: Date.now()
    };

    const data = JSON.stringify(message);
    this.clients.forEach((authWs) => {
      if (authWs.isAuthenticated && authWs.readyState === WebSocket.OPEN) {
        try {
          authWs.send(data);
        } catch (error) {
          logger.error('发送日志到WebSocket失败:', error);
        }
      }
    });
  }

  private broadcastLog(entry: LogEntry): void {
    const message = {
      type: 'log',
      data: entry,
      timestamp: Date.now()
    };

    const data = JSON.stringify(message);
    this.clients.forEach((authWs) => {
      if (authWs.isAuthenticated && authWs.readyState === WebSocket.OPEN) {
        try {
          authWs.send(data);
        } catch (error) {
          logger.error('发送日志到WebSocket失败:', error);
        }
      }
    });
  }

  public broadcast(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach((authWs) => {
      if (authWs.isAuthenticated && authWs.readyState === WebSocket.OPEN) {
        authWs.send(data);
      }
    });
  }

  public sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  public sendToUser(userId: string, message: WebSocketMessage): void {
    const userClients = this.authenticatedClients.get(userId);
    if (userClients) {
      const data = JSON.stringify(message);
      userClients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    }
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }

  public getAuthenticatedCount(): number {
    let count = 0;
    this.authenticatedClients.forEach((clients) => {
      count += clients.size;
    });
    return count;
  }

  public closeAll(): void {
    if (this.logDebounceTimer) {
      clearTimeout(this.logDebounceTimer);
      this.logDebounceTimer = null;
    }

    this.logBuffer = [];

    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.clients.clear();
    this.authenticatedClients.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export default new WebSocketManager();