import { Router, Request, Response } from 'express';
import { authMiddleware } from './middleware/auth.js';
import { violationService } from '../db/services/ViolationService.js';
import { ViolationType, ViolationStatus } from '../db/entities/Violation.js';
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
 * 获取所有违规记录
 * GET /api/violations
 */
router.get('/api/violations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

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

    const status = req.query.status as ViolationStatus;
    const violation_type = req.query.violation_type as ViolationType;

    const { violations, total } = await violationService.getAllViolations({
      limit: pageSize,
      offset,
      status,
      violation_type
    });

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      code: 200,
      message: '获取违规记录成功',
      data: violations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    logger.error('获取违规记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取违规记录失败',
      data: null
    });
  }
});

/**
 * 获取单个违规记录
 * GET /api/violations/:id
 */
router.get('/api/violations/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const violationId = parseInt(req.params.id);

    if (isNaN(violationId)) {
      return res.status(400).json({
        code: 400,
        message: '违规记录ID必须是数字'
      });
    }

    const violation = await violationService.getViolationById(violationId);

    if (!violation) {
      return res.status(404).json({
        code: 404,
        message: '违规记录不存在',
        data: null
      });
    }

    res.status(200).json({
      code: 200,
      message: '获取违规记录成功',
      data: violation
    });
  } catch (error) {
    logger.error('获取违规记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取违规记录失败',
      data: null
    });
  }
});

/**
 * 获取用户的违规记录
 * GET /api/violations/user/:userId
 */
router.get('/api/violations/user/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({
        code: 400,
        message: '用户ID必须是数字'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

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

    const status = req.query.status as ViolationStatus;

    const { violations, total } = await violationService.getViolationsByUserId(userId, {
      limit: pageSize,
      offset,
      status
    });

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      code: 200,
      message: '获取用户违规记录成功',
      data: violations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    logger.error('获取用户违规记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户违规记录失败',
      data: null
    });
  }
});

/**
 * 根据类型获取违规记录
 * GET /api/violations/type/:type
 */
router.get('/api/violations/type/:type', authMiddleware, async (req: Request, res: Response) => {
  try {
    const violationType = req.params.type as ViolationType;

    if (!Object.values(ViolationType).includes(violationType)) {
      return res.status(400).json({
        code: 400,
        message: '无效的违规类型'
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const offset = (page - 1) * pageSize;

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

    const { violations, total } = await violationService.getViolationsByType(violationType, {
      limit: pageSize,
      offset
    });

    const totalPages = Math.ceil(total / pageSize);

    res.status(200).json({
      code: 200,
      message: '获取违规记录成功',
      data: violations,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    });
  } catch (error) {
    logger.error('获取违规记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取违规记录失败',
      data: null
    });
  }
});

/**
 * 更新违规记录状态
 * PATCH /api/violations/:id/status
 */
router.patch('/api/violations/:id/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const violationId = parseInt(req.params.id);

    if (isNaN(violationId)) {
      return res.status(400).json({
        code: 400,
        message: '违规记录ID必须是数字'
      });
    }

    const { status } = req.body;

    if (!status || !Object.values(ViolationStatus).includes(status)) {
      return res.status(400).json({
        code: 400,
        message: '无效的状态值'
      });
    }

    const success = await violationService.updateViolationStatus(violationId, status);

    if (!success) {
      return res.status(404).json({
        code: 404,
        message: '违规记录不存在'
      });
    }

    res.status(200).json({
      code: 200,
      message: '更新违规记录状态成功',
      data: null
    });
  } catch (error) {
    logger.error('更新违规记录状态失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新违规记录状态失败',
      data: null
    });
  }
});

/**
 * 删除违规记录
 * DELETE /api/violations/:id
 */
router.delete('/api/violations/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const violationId = parseInt(req.params.id);

    if (isNaN(violationId)) {
      return res.status(400).json({
        code: 400,
        message: '违规记录ID必须是数字'
      });
    }

    const success = await violationService.deleteViolation(violationId);

    if (!success) {
      return res.status(404).json({
        code: 404,
        message: '违规记录不存在'
      });
    }

    res.status(200).json({
      code: 200,
      message: '删除违规记录成功',
      data: null
    });
  } catch (error) {
    logger.error('删除违规记录失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除违规记录失败',
      data: null
    });
  }
});

export default router;
