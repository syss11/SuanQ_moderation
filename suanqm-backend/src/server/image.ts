import { Router, Request, Response } from 'express';
import { authMiddleware } from './middleware/auth.js';
import { AppDataSource } from '../db/database.js';
import { Image } from '../db/entities/Image.js';
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

interface ImageResponse {
  id: number;
  url: string;
  reason: string | null;
  banned: boolean;
  md5: string;
  size: number;
}

function buildImageUrl(req: Request, filename: string): string {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/public/images/${filename}`;
}

router.get('/api/images/banned', authMiddleware, async (req: Request, res: Response) => {
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

    const dataSource = AppDataSource;
    if (!dataSource) {
      return res.status(500).json({
        code: 500,
        message: '数据库连接未初始化'
      });
    }

    const imageRepository = dataSource.getRepository(Image);

    const [images, total] = await imageRepository.findAndCount({
      where: { banned: true },
      order: { created_at: 'DESC' },
      take: pageSize,
      skip: offset
    });

    const totalPages = Math.ceil(total / pageSize);

    const responseData: ImageResponse[] = images.map(image => ({
      id: image.id,
      url: buildImageUrl(req, image.filename),
      reason: image.ban_reason,
      banned: image.banned,
      md5: image.md5,
      size: image.size
    }));

    const response: PaginatedResponse<ImageResponse> = {
      code: 200,
      message: '获取被禁止图片成功',
      data: responseData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('获取被禁止图片失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取被禁止图片失败',
      data: null
    });
  }
});

router.get('/api/images/unbanned', authMiddleware, async (req: Request, res: Response) => {
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

    const dataSource = AppDataSource;
    if (!dataSource) {
      return res.status(500).json({
        code: 500,
        message: '数据库连接未初始化'
      });
    }

    const imageRepository = dataSource.getRepository(Image);

    const [images, total] = await imageRepository.findAndCount({
      where: { banned: false },
      order: { created_at: 'DESC' },
      take: pageSize,
      skip: offset
    });

    const totalPages = Math.ceil(total / pageSize);

    const responseData: ImageResponse[] = images.map(image => ({
      id: image.id,
      url: buildImageUrl(req, image.filename),
      reason: image.ban_reason,
      banned: image.banned,
      md5: image.md5,
      size: image.size
    }));

    const response: PaginatedResponse<ImageResponse> = {
      code: 200,
      message: '获取未封禁图片成功',
      data: responseData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('获取未封禁图片失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取未封禁图片失败',
      data: null
    });
  }
});

router.get('/api/images/:imageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const imageId = parseInt(req.params.imageId);

    if (isNaN(imageId)) {
      return res.status(400).json({
        code: 400,
        message: '图片ID格式错误'
      });
    }

    const dataSource = AppDataSource;
    if (!dataSource) {
      return res.status(500).json({
        code: 500,
        message: '数据库连接未初始化'
      });
    }

    const imageRepository = dataSource.getRepository(Image);
    const image = await imageRepository.findOne({
      where: { id: imageId }
    });

    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '图片不存在'
      });
    }

    const responseData: ImageResponse = {
      id: image.id,
      url: buildImageUrl(req, image.filename),
      reason: image.ban_reason,
      banned: image.banned,
      md5: image.md5,
      size: image.size
    };

    res.status(200).json({
      code: 200,
      message: '获取图片成功',
      data: responseData
    });
  } catch (error) {
    logger.error('获取图片失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取图片失败',
      data: null
    });
  }
});

router.delete('/api/images/:imageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const imageId = parseInt(req.params.imageId);

    if (isNaN(imageId)) {
      return res.status(400).json({
        code: 400,
        message: '图片ID格式错误'
      });
    }

    const dataSource = AppDataSource;
    if (!dataSource) {
      return res.status(500).json({
        code: 500,
        message: '数据库连接未初始化'
      });
    }

    const imageRepository = dataSource.getRepository(Image);
    const image = await imageRepository.findOne({
      where: { id: imageId }
    });

    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '图片不存在'
      });
    }

    await imageRepository.remove(image);

    logger.log(`图片已删除: ID=${imageId}, filename=${image.filename}`);

    res.status(200).json({
      code: 200,
      message: '图片删除成功',
      data: null
    });
  } catch (error) {
    logger.error('删除图片失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除图片失败',
      data: null
    });
  }
});

router.patch('/api/images/:imageId/unban', authMiddleware, async (req: Request, res: Response) => {
  try {
    const imageId = parseInt(req.params.imageId);

    if (isNaN(imageId)) {
      return res.status(400).json({
        code: 400,
        message: '图片ID格式错误'
      });
    }

    const dataSource = AppDataSource;
    if (!dataSource) {
      return res.status(500).json({
        code: 500,
        message: '数据库连接未初始化'
      });
    }

    const imageRepository = dataSource.getRepository(Image);
    const image = await imageRepository.findOne({
      where: { id: imageId }
    });

    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '图片不存在'
      });
    }

    if (!image.banned) {
      return res.status(400).json({
        code: 400,
        message: '图片未被禁止'
      });
    }

    image.banned = false;
    image.ban_reason = null;
    await imageRepository.save(image);

    logger.log(`图片已解禁: ID=${imageId}, filename=${image.filename}`);

    const responseData: ImageResponse = {
      id: image.id,
      url: buildImageUrl(req, image.filename),
      reason: image.ban_reason,
      banned: image.banned,
      md5: image.md5,
      size: image.size
    };

    res.status(200).json({
      code: 200,
      message: '图片解禁成功',
      data: responseData
    });
  } catch (error) {
    logger.error('解禁图片失败:', error);
    res.status(500).json({
      code: 500,
      message: '解禁图片失败',
      data: null
    });
  }
});

router.patch('/api/images/:imageId/ban', authMiddleware, async (req: Request, res: Response) => {
  try {
    const imageId = parseInt(req.params.imageId);
    const { reason } = req.body;

    if (isNaN(imageId)) {
      return res.status(400).json({
        code: 400,
        message: '图片ID格式错误'
      });
    }

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '封禁原因不能为空'
      });
    }

    const dataSource = AppDataSource;
    if (!dataSource) {
      return res.status(500).json({
        code: 500,
        message: '数据库连接未初始化'
      });
    }

    const imageRepository = dataSource.getRepository(Image);
    const image = await imageRepository.findOne({
      where: { id: imageId }
    });

    if (!image) {
      return res.status(404).json({
        code: 404,
        message: '图片不存在'
      });
    }

    if (image.banned) {
      return res.status(400).json({
        code: 400,
        message: '图片已被禁止'
      });
    }

    image.banned = true;
    image.ban_reason = reason;
    await imageRepository.save(image);

    logger.log(`图片已封禁: ID=${imageId}, filename=${image.filename}, reason=${reason}`);

    const responseData: ImageResponse = {
      id: image.id,
      url: buildImageUrl(req, image.filename),
      reason: image.ban_reason,
      banned: image.banned,
      md5: image.md5,
      size: image.size
    };

    res.status(200).json({
      code: 200,
      message: '图片封禁成功',
      data: responseData
    });
  } catch (error) {
    logger.error('封禁图片失败:', error);
    res.status(500).json({
      code: 500,
      message: '封禁图片失败',
      data: null
    });
  }
});

export default router;