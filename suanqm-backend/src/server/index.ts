import express, { Application, Request, Response } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import messageRoutes from './message.js';
import chatRoutes from './chat.js';
import authRoutes from './auth.js';
import systemRoutes from './system.js';
import settingsRoutes from './settings.js';
import imageRoutes from './image.js';
import violationRoutes from './violation.js';
import logsRoutes from './logs.js';
import sensitiveRoutes from './sensitive.js';
import statisticsRoutes from './statistics.js';
import commandLogRoutes from './command_logs.js';
import cors from 'cors';
import { logger } from '../logger.js';
import websocketManager from './websocket.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
class WebServer {
  private app: Application;
  private server: HttpServer;
  private port: number;

  constructor(port: number = 6065) {
    this.app = express();
    this.port = port;
    this.server = createServer(this.app);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    if (process.env.APP_ENV === 'development') {
      this.app.use(cors());
    }
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    const publicPath = join(__dirname, '../../public');
    this.app.use('/public', express.static(publicPath));
    logger.log(`Static files served from: ${publicPath}`);
    
    const distPath = join(__dirname, '../../public/dist');
    this.app.use(express.static(distPath));
    logger.log(`Vue app served from: ${distPath}`);
  }

  private setupRoutes(): void {
    // 根路由 - 返回Vue应用
    this.app.get('/', (req: Request, res: Response) => {
      const indexPath = join(__dirname, '../../public/dist/index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(404).json({ 
            error: 'Vue app not found. Please build the Vue app first.' 
          });
        }
      });
    });

    // 健康检查路由
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString() 
      });
    });


    // 认证相关路由
    this.app.use(authRoutes);

    // 消息相关路由
    this.app.use(messageRoutes);

    // 聊天相关路由
    this.app.use(chatRoutes);

    // 系统相关路由
    this.app.use(systemRoutes);

    // 设置相关路由
    this.app.use(settingsRoutes);

    // 图片相关路由
    this.app.use(imageRoutes);

    // 违规记录相关路由
    this.app.use(violationRoutes);

    // 日志相关路由
    this.app.use(logsRoutes);

    // 敏感词相关路由
    this.app.use(sensitiveRoutes);

    // 统计相关路由
    this.app.use(statisticsRoutes);

    // 命令日志相关路由
    this.app.use(commandLogRoutes);

    // SPA路由处理 - 所有非API路由都返回index.html
    this.app.get('*path', (req: Request, res: Response) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/public')) {
        return res.status(404).json({ 
          error: 'Route not found' 
        });
      }
      
      const indexPath = join(__dirname, '../../public/dist/index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          res.status(404).json({ 
            error: 'Vue app not found. Please build the Vue app first.' 
          });
        }
      });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.log(`Web server is running on port ${this.port}`);
        if (process.env.APP_ENV === 'development') {
          logger.log('CORS is enabled for development environment');
        }
        
        websocketManager.initialize(this.server);
        logger.log('WebSocket server initialized');
        
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.log('Web server closed');
        resolve();
      });
    });
  }

  public getApp(): Application {
    return this.app;
  }

  public getServer(): HttpServer {
    return this.server;
  }
}

export default WebServer;