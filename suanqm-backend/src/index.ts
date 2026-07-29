import 'reflect-metadata';
import { Structs } from 'node-napcat-ts'
import napcat from './napcat/index.js'
import { SqAdapter } from './napcat/adapter.js'
import { main_handlers } from './napcat/main.js'
import { initializeDatabase } from './db/init.js';
import WebServer from './server/index.js';
import { setJwtSecret } from './server/middleware/auth.js';
import { getConfig } from './config/index.js';
import * as dotenv from 'dotenv';
import { err_handlers } from './napcat/exception.js';
import crypto from 'crypto';
import { logger } from './logger.js';
import dailyResetService from './services/DailyResetService.js';
import websocketManager from './server/websocket.js';
import { AppDataSource } from './db/database.js';
import pluginManager from './plugins.js';
import * as fs from 'fs';
import * as path from 'path';

// 检查 .env 文件是否存在
const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  logger.error('========================================');
  logger.error('配置文件 .env 不存在');
  logger.error('请根据 CONFIG.md 文档进行配置');
  logger.error('========================================');
  process.exit(1);
}

dotenv.config();

const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
setJwtSecret(jwtSecret);
logger.log('JWT密钥已设置');

function generateRandomPassword(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

function ensureAuthPassword() {
  const envPath = path.join(process.cwd(), '.env');
  const DEFAULT_PLACEHOLDER = 'your_auth_password';
  const currentPassword = process.env.AUTH_PASSWORD;
  
  const isPasswordEmpty = !currentPassword;
  const isPasswordPlaceholder = currentPassword === DEFAULT_PLACEHOLDER;
  
  if (isPasswordEmpty || isPasswordPlaceholder) {
    const randomPassword = generateRandomPassword(24);
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    if (envContent.includes('AUTH_PASSWORD=')) {
      envContent = envContent.replace(/AUTH_PASSWORD=.*/, `AUTH_PASSWORD=${randomPassword}`);
    } else {
      envContent += `\nAUTH_PASSWORD=${randomPassword}`;
    }
    
    fs.writeFileSync(envPath, envContent, 'utf-8');
    process.env.AUTH_PASSWORD = randomPassword;
    
    const reason = isPasswordEmpty ? '未设置密码' : '检测到默认占位符密码';
    
    logger.log('========================================');
    logger.log(`⚠️  ${reason}，已自动生成安全密码`);
    logger.log('========================================');
    logger.log(`认证密码: ${randomPassword}`);
    logger.log('========================================');
    logger.log('请妥善保存此密码，用于登录管理后台');
    logger.log('如需修改，请编辑 .env 文件中的 AUTH_PASSWORD');
    logger.log('========================================');
  }
}

ensureAuthPassword();

const isTestMode = process.env.NODE_ENV === 'test';

try {
  await initializeDatabase();
} catch (error: any) {
  logger.error('========================================');
  logger.error('数据库初始化失败');
  logger.error('========================================');
  logger.error('错误信息:', error.message || error);
  logger.error('');
  logger.error('可能的原因:');
  logger.error('  1. .env 文件中的数据库配置不正确');
  logger.error('  2. MySQL 服务未启动（如果使用 MySQL）');
  logger.error('  3. 数据库用户名或密码错误');
  logger.error('');
  logger.error('解决方法:');
  logger.error('  - 检查 .env 文件中的 DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD');
  logger.error('  - 如果使用 MySQL，确保 MySQL 服务正在运行');
  logger.error('  - 如果使用 sqljs，确保 data 目录有写入权限');
  logger.error('========================================');
  process.exit(1);
}


const adapter=new SqAdapter(napcat, isTestMode)
const all_handlers = [...main_handlers, ...err_handlers]
adapter.register_handlers(all_handlers)

const webServerPort = parseInt(process.env.APP_PORT || '6065', 10);
const webServer = new WebServer(webServerPort);

export let isShuttingDown = false;

export async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.log('Received kill signal, shutting down gracefully');

  try {
    dailyResetService.stop();

    await pluginManager.unloadAllPlugins();
    logger.log('Plugins unloaded');

    websocketManager.closeAll();
    logger.log('WebSocket server closed');

    if (!isTestMode) {
      napcat.disconnect();
      logger.log('Napcat disconnected');
    }

    await webServer.stop();
    
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.log('Database connection closed');
    }

    logger.log('Shutdown complete');
    process.exit(0);
    
    
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

async function startServices() {
  try {
    await webServer.start();
    const napcatConfig = getConfig().napcat;
    if (!napcatConfig) {
      throw new Error('Napcat 配置未在 config/config.json 中定义');
    }
    
    if (!isTestMode) {
      logger.log('正在连接 Napcat...');
      logger.log(`连接地址: ${napcatConfig.protocol}://${napcatConfig.host}:${napcatConfig.port}`);
      
      try {
        const connectPromise = napcat.connect();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Napcat 连接超时（15秒）')), 15000)
        );
        
        await Promise.race([connectPromise, timeoutPromise]);
        logger.log('napcat connected');
      } catch (error: any) {
        logger.error('========================================');
        logger.error('Napcat 连接失败');
        logger.error('========================================');
        
        if (error.message && error.message.includes('超时')) {
          logger.error('错误类型: 连接超时');
          logger.error('');
          logger.error('可能的原因:');
          logger.error('  1. Napcat 服务未启动');
          logger.error('  2. 网络连接不稳定');
          logger.error('  3. 防火墙阻止了连接');
          logger.error('');
          logger.error('解决方法:');
          logger.error('  - 检查 Napcat 服务是否正在运行');
          logger.error('  - 检查防火墙设置，允许端口 3011');
          logger.error('  - 尝试使用 telnet 或 nc 测试连接:');
          logger.error(`    telnet ${napcatConfig.host} ${napcatConfig.port}`);
        } else if (error.error_type === 'connect_error') {
          logger.error('错误类型: WebSocket 连接错误');
          logger.error('');
          logger.error('可能的原因:');
          logger.error('  1. Napcat 服务地址或端口配置错误');
          logger.error('  2. Napcat 服务未运行');
          logger.error('  3. 网络不可达');
          logger.error('');
          logger.error('当前配置:');
          logger.error(`  协议: ${napcatConfig.protocol}`);
          logger.error(`  主机: ${napcatConfig.host}`);
          logger.error(`  端口: ${napcatConfig.port}`);
          logger.error(`  重连次数: ${napcatConfig.reconnection?.attempts || 0}`);
          logger.error(`  重连延迟: ${napcatConfig.reconnection?.delay || 0}ms`);
          logger.error('');
          logger.error('解决方法:');
          logger.error('  - 检查 config/config.json 中的 napcat 配置');
          logger.error('  - 确认 Napcat 服务正在运行');
          logger.error('  - 检查网络连接和 DNS 解析');
          logger.error('  - 如果使用 Docker，检查网络配置（可能需要使用 host.docker.internal）');
        } else {
          logger.error('错误信息:', error.message || error);
          logger.error('');
          logger.error('详细错误:', JSON.stringify(error, null, 2));
        }
        
        
        logger.error('========================================');
        await shutdown();
      }
    } else {
      logger.log('Running in test mode - napcat connection skipped');
    }

    pluginManager.initialize(adapter, getConfig, AppDataSource, webServer);
    try {
      await pluginManager.loadAllPlugins();
    } catch (error) {
      logger.error('Failed to load plugins:', error);
      throw error;
    }

    logger.log('All services started successfully');

    dailyResetService.start();
  } catch (error) {
    logger.error('Failed to start services:', error);
    await shutdown();
  }
}

startServices().catch(console.error);

export { adapter, main_handlers as all_handlers, webServer }