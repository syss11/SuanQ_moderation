import express, { Request, Response } from 'express';
import { messageQuery } from '../db/services/MessageQuery.js';
import { authMiddleware } from './middleware/auth.js';
import { logger } from '../logger.js';

const router = express.Router();

// 获取所有消息
router.get('/api/message', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { 
      messageType, user_id, group_id, target_id, 
      limit, offset, start_time, end_time 
    } = req.query;

    const messages = await messageQuery.getAllMessages({
      message_type: messageType as 'group' | 'private' | undefined,
      user_id: user_id ? parseInt(user_id as string) : undefined,
      group_id: group_id ? parseInt(group_id as string) : undefined,
      target_id: target_id ? parseInt(target_id as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
      start_time: start_time ? parseInt(start_time as string) : undefined,
      end_time: end_time ? parseInt(end_time as string) : undefined
    });

    res.status(200).json({
      code: 200,
      data: messages,
      message: '获取消息成功'
    });
  } catch (error) {
    logger.error('获取消息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取消息失败'
    });
  }
});

// 获取群聊消息
router.get('/api/message/group', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { groupId, user_id, limit, offset, start_time, end_time } = req.query;

    if (!groupId) {
      return res.status(400).json({
        code: 400,
        message: '缺少groupId参数'
      });
    }

    const messages = await messageQuery.getGroupMessages({
      group_id: parseInt(groupId as string),
      user_id: user_id ? parseInt(user_id as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
      start_time: start_time ? parseInt(start_time as string) : undefined,
      end_time: end_time ? parseInt(end_time as string) : undefined
    });

    res.status(200).json({
      code: 200,
      data: messages,
      message: '获取群聊消息成功'
    });
  } catch (error) {
    logger.error('获取群聊消息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取群聊消息失败'
    });
  }
});

// 获取私聊消息
router.get('/api/message/private', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, target_id, limit, offset, start_time, end_time } = req.query;

    if (!userId) {
      return res.status(400).json({
        code: 400,
        message: '缺少userId参数'
      });
    }

    const messages = await messageQuery.getPrivateMessages({
      user_id: parseInt(userId as string),
      target_id: target_id ? parseInt(target_id as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
      start_time: start_time ? parseInt(start_time as string) : undefined,
      end_time: end_time ? parseInt(end_time as string) : undefined
    });

    res.status(200).json({
      code: 200,
      data: messages,
      message: '获取私聊消息成功'
    });
  } catch (error) {
    logger.error('获取私聊消息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取私聊消息失败'
    });
  }
});

// 获取单个消息
router.get('/api/message/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const message = await messageQuery.getMessageById(parseInt(messageId));

    if (!message) {
      return res.status(404).json({
        code: 404,
        message: '消息不存在'
      });
    }

    res.status(200).json({
      code: 200,
      data: message,
      message: '获取消息成功'
    });
  } catch (error) {
    logger.error('获取消息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取消息失败'
    });
  }
});

// 获取消息图片
router.get('/api/message/:messageId/images', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const images = await messageQuery.getMessageImages(parseInt(messageId));

    res.status(200).json({
      code: 200,
      data: images,
      message: '获取消息图片成功'
    });
  } catch (error) {
    logger.error('获取消息图片失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取消息图片失败'
    });
  }
});

export default router;
