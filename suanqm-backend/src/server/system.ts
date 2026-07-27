import { Router } from 'express';
import { authMiddleware } from './middleware/auth.js';
import napcat from '../napcat/index.js';
import { get_avatar_url_by_userid } from '../napcat/utils.js';
import { logger } from '../logger.js';
import * as os from 'os';
import websocketManager from './websocket.js';
import { shutdown, isShuttingDown } from '../index.js';

const router = Router();

/**
 * 获取当前机器人的self_id和昵称
 * GET /api/system/self-id
 * 需要认证
 */
router.get('/api/system/self-id', authMiddleware, async (req, res) => {
  try {
    const loginInfo = await napcat.get_login_info();
    
    // 获取头像URL
    const avatar_url = get_avatar_url_by_userid(loginInfo.user_id);
    
    res.status(200).json({
      code: 200,
      message: '获取登录信息成功',
      data: {
        self_id: loginInfo.user_id,
        nickname: loginInfo.nickname,
        avatar_url: avatar_url
      }
    });
  } catch (error) {
    logger.error('获取登录信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取登录信息失败',
      data: null
    });
  }
});

/**
 * 获取系统信息（内存、系统时间等）
 * GET /api/system/info
 * 需要认证
 */
router.get('/api/system/info', authMiddleware, async (req, res) => {
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = ((usedMemory / totalMemory) * 100).toFixed(2);

    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();
    const osType = os.type();
    const osRelease = os.release();
    
    const currentTime = new Date().toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    const loadAverage = os.loadavg();
    
    const wsConnectedCount = websocketManager.getConnectedCount();
    const wsAuthenticatedCount = websocketManager.getAuthenticatedCount();

    res.status(200).json({
      code: 200,
      message: '获取系统信息成功',
      data: {
        system: {
          platform,
          arch,
          hostname,
          type: osType,
          release: osRelease,
          
        },
        cpu: {
          loadAverage: loadAverage
        },
        memory: {
          total: totalMemory,
          free: freeMemory,
          used: usedMemory,
          usagePercent: `${memoryUsage}%`,
          totalGB: (totalMemory / 1024 / 1024 / 1024).toFixed(2),
          freeGB: (freeMemory / 1024 / 1024 / 1024).toFixed(2),
          usedGB: (usedMemory / 1024 / 1024 / 1024).toFixed(2)
        },
        time: {
          currentTime,
          timezone
        },
        websocket: {
          connected: wsConnectedCount,
          authenticated: wsAuthenticatedCount,
          status: 'active'
        }
      }
    });
  } catch (error) {
    logger.error('获取系统信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取系统信息失败',
      data: null
    });
  }
});

/**
 * 关闭服务器
 * POST /api/system/shutdown
 * 需要认证
 */
router.post('/api/system/shutdown', authMiddleware, async (req, res) => {
  try {
    if (isShuttingDown) {
      return res.status(400).json({
        code: 400,
        message: '服务器正在关闭中'
      });
    }

    logger.log('收到关闭请求，准备关闭服务器...');

    res.status(200).json({
      code: 200,
      message: '服务器正在关闭',
      data: null
    });

    setTimeout(() => {
      shutdown();
    }, 1000);
  } catch (error) {
    logger.error('关闭服务器失败:', error);
    res.status(500).json({
      code: 500,
      message: '关闭服务器失败',
      data: null
    });
  }
});

export default router;