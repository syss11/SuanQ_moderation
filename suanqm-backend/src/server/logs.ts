import { Router, Request, Response } from 'express';
import { authMiddleware } from './middleware/auth.js';
import { logger } from '../logger.js';

const router = Router();

interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 获取所有日志（内存+文件）
 * GET /api/logs
 */
router.get('/api/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;
    const offset = (page - 1) * pageSize;
    const level = req.query.level as string;

    if (page < 1) {
      return res.status(400).json({
        code: 400,
        message: '页码必须大于0'
      });
    }

    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        code: 400,
        message: '每页数量必须在1-100之间'
      });
    }

    const { logs, total } = await logger.getAllLogs({
      level,
      limit: pageSize,
      offset
    });

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      code: 200,
      message: '获取日志成功',
      data: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取日志失败',
      data: null
    });
  }
});

/**
 * 获取文件中的日志
 * GET /api/logs/file
 */
router.get('/api/logs/file', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;
    const offset = (page - 1) * pageSize;
    const level = req.query.level as string;

    if (page < 1) {
      return res.status(400).json({
        code: 400,
        message: '页码必须大于0'
      });
    }

    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        code: 400,
        message: '每页数量必须在1-100之间'
      });
    }

    const { logs, total } = await logger.getLogsFromFile({
      level,
      limit: pageSize,
      offset
    });

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      code: 200,
      message: '获取文件日志成功',
      data: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    console.error('获取文件日志失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取文件日志失败',
      data: null
    });
  }
});

/**
 * 清空文件日志
 * DELETE /api/logs/file
 */
router.delete('/api/logs/file', authMiddleware, async (req: Request, res: Response) => {
  try {
    await logger.clearLogFile();

    res.status(200).json({
      code: 200,
      message: '清空文件日志成功',
      data: null
    });
  } catch (error) {
    console.error('清空文件日志失败:', error);
    res.status(500).json({
      code: 500,
      message: '清空文件日志失败',
      data: null
    });
  }
});

/**
 * 清空所有日志
 * DELETE /api/logs
 */
router.delete('/api/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    await logger.clearAllLogs();

    res.status(200).json({
      code: 200,
      message: '清空所有日志成功',
      data: null
    });
  } catch (error) {
    console.error('清空所有日志失败:', error);
    res.status(500).json({
      code: 500,
      message: '清空所有日志失败',
      data: null
    });
  }
});

/**
 * 获取日志统计信息
 * GET /api/logs/stats
 */
router.get('/api/logs/stats', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { logs: allLogs } = await logger.getAllLogs({ limit: 100, offset: 0 });
    const { logs: fileLogs } = await logger.getLogsFromFile({ limit: Infinity, offset: 0 });

    const stats = {
      total: allLogs.length,
      file: fileLogs.length,
      byLevel: {
        DEBUG: allLogs.filter(log => log.level === 'DEBUG').length,
        INFO: allLogs.filter(log => log.level === 'INFO').length,
        WARN: allLogs.filter(log => log.level === 'WARN').length,
        ERROR: allLogs.filter(log => log.level === 'ERROR').length,
        LOG: allLogs.filter(log => log.level === 'LOG').length
      }
    };

    res.status(200).json({
      code: 200,
      message: '获取日志统计成功',
      data: stats
    });
  } catch (error) {
    console.error('获取日志统计失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取日志统计失败',
      data: null
    });
  }
});

export default router;
