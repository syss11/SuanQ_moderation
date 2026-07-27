import { Router, Request, Response } from 'express';
import { authMiddleware } from './middleware/auth.js';
import commandLogService from '../db/services/CommandLogService.js';

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

router.get('/api/command-logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const command = req.query.command as string;
    const isCoAdmin = req.query.isCoAdmin === 'true';
    const success = req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined;

    if (page < 1) {
      return res.status(400).json({ code: 400, message: '页码必须大于0' });
    }
    if (pageSize < 1 || pageSize > 200) {
      return res.status(400).json({ code: 400, message: '每页数量必须在1-200之间' });
    }

    const where: Record<string, any> = {};
    if (groupId !== undefined) where.group_id = groupId;
    if (userId !== undefined) where.user_id = userId;
    if (command) where.command = command;
    if (isCoAdmin) where.is_co_admin = true;
    if (success !== undefined) where.success = success;

    const [logs, total] = await commandLogService.repository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      code: 200,
      message: '获取命令日志成功',
      data: logs,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    console.error('获取命令日志失败:', error);
    res.status(500).json({ code: 500, message: '获取命令日志失败', data: null });
  }
});

router.get('/api/command-logs/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ code: 400, message: 'ID必须是数字' });
    }

    const log = await commandLogService.repository.findOne({ where: { id } });
    if (!log) {
      return res.status(404).json({ code: 404, message: '日志记录不存在' });
    }

    res.status(200).json({ code: 200, message: '获取日志成功', data: log });
  } catch (error) {
    console.error('获取命令日志失败:', error);
    res.status(500).json({ code: 500, message: '获取命令日志失败', data: null });
  }
});

router.get('/api/command-logs/stats/by-command', authMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await commandLogService.getStatsByCommand();
    res.status(200).json({ code: 200, message: '获取命令统计成功', data: stats });
  } catch (error) {
    console.error('获取命令统计失败:', error);
    res.status(500).json({ code: 500, message: '获取命令统计失败', data: null });
  }
});

router.get('/api/command-logs/stats/by-user', authMiddleware, async (req: Request, res: Response) => {
  try {
    const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
    const stats = await commandLogService.getStatsByUser(groupId);
    res.status(200).json({ code: 200, message: '获取用户统计成功', data: stats });
  } catch (error) {
    console.error('获取用户统计失败:', error);
    res.status(500).json({ code: 500, message: '获取用户统计失败', data: null });
  }
});

router.get('/api/command-logs/stats/co-admin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;
    const stats = await commandLogService.getCoAdminStats(groupId);
    res.status(200).json({ code: 200, message: '获取协管统计成功', data: stats });
  } catch (error) {
    console.error('获取协管统计失败:', error);
    res.status(500).json({ code: 500, message: '获取协管统计失败', data: null });
  }
});

router.get('/api/command-logs/co-admin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const groupId = req.query.groupId ? parseInt(req.query.groupId as string) : undefined;

    if (page < 1) return res.status(400).json({ code: 400, message: '页码必须大于0' });
    if (pageSize < 1 || pageSize > 200) return res.status(400).json({ code: 400, message: '每页数量必须在1-200之间' });

    const [logs, total] = await commandLogService.repository.findAndCount({
      where: { is_co_admin: true, ...(groupId !== undefined ? { group_id: groupId } : {}) },
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    res.status(200).json({
      code: 200,
      message: '获取协管命令日志成功',
      data: logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('获取协管命令日志失败:', error);
    res.status(500).json({ code: 500, message: '获取协管命令日志失败', data: null });
  }
});

router.get('/api/command-logs/failed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    if (page < 1) return res.status(400).json({ code: 400, message: '页码必须大于0' });
    if (pageSize < 1 || pageSize > 200) return res.status(400).json({ code: 400, message: '每页数量必须在1-200之间' });

    const [logs, total] = await commandLogService.repository.findAndCount({
      where: { success: false },
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    res.status(200).json({
      code: 200,
      message: '获取失败命令日志成功',
      data: logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('获取失败命令日志失败:', error);
    res.status(500).json({ code: 500, message: '获取失败命令日志失败', data: null });
  }
});

router.post('/api/command-logs/:id/reason', authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(id)) return res.status(400).json({ code: 400, message: 'ID必须是数字' });
    if (!reason || typeof reason !== 'string') return res.status(400).json({ code: 400, message: 'reason不能为空' });

    const log = await commandLogService.addReason(id, reason);
    if (!log) return res.status(404).json({ code: 404, message: '日志记录不存在' });

    res.status(200).json({ code: 200, message: '添加原因成功', data: log });
  } catch (error) {
    console.error('添加原因失败:', error);
    res.status(500).json({ code: 500, message: '添加原因失败', data: null });
  }
});

router.delete('/api/command-logs/old', authMiddleware, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    if (days < 1) return res.status(400).json({ code: 400, message: '天数必须大于0' });

    await commandLogService.deleteOldLogs(days);
    res.status(200).json({ code: 200, message: `已删除${days}天前的日志`, data: null });
  } catch (error) {
    console.error('删除旧日志失败:', error);
    res.status(500).json({ code: 500, message: '删除旧日志失败', data: null });
  }
});

export default router;