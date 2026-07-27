import { Router } from 'express';
import { authMiddleware } from './middleware/auth.js';
import { statisticsService } from '../services/statistics.js';
import { AppDataSource } from '../db/database.js';
import { GroupChat } from '../db/entities/index.js';
import { checkWhitelistBlacklist } from '../handler/index.js';

const router = Router();

/**
 * 获取消息趋势
 * GET /api/statistics/message-trend
 * 需要认证
 * 
 * @param period - 统计周期: day/week/month
 * @param count - 数量
 * @param groupId - 可选，指定群ID
 */
router.get('/api/statistics/message-trend', authMiddleware, async (req, res) => {
  try {
    const { period, count, groupId } = req.query;
    
    if (!period || !count) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: period 和 count',
        data: null
      });
    }

    if (!['day', 'week', 'month'].includes(period as string)) {
      return res.status(400).json({
        code: 400,
        message: 'period 必须是 day、week 或 month',
        data: null
      });
    }

    const countNum = parseInt(count as string);
    if (isNaN(countNum) || countNum <= 0) {
      return res.status(400).json({
        code: 400,
        message: 'count 必须是正整数',
        data: null
      });
    }

    let groupIdNum: number | undefined;
    if (groupId) {
      const parsed = parseInt(groupId as string);
      if (isNaN(parsed)) {
        return res.status(400).json({
          code: 400,
          message: 'groupId 必须是数字',
          data: null
        });
      }
      groupIdNum = parsed;
    }

    const result = groupIdNum !== undefined 
      ? await statisticsService.getMessageTrend(period as 'day' | 'week' | 'month', countNum, groupIdNum)
      : await statisticsService.getMessageTrend(period as 'day' | 'week' | 'month', countNum);

    res.status(200).json({
      code: 200,
      message: '获取消息趋势成功',
      data: result
    });
  } catch (error) {
    console.error('获取消息趋势失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取消息趋势失败',
      data: null
    });
  }
});

/**
 * 获取用户消息排行榜
 * GET /api/statistics/user-ranking
 * 需要认证
 * 
 * @param limit - 返回数量限制，默认10
 * @param groupId - 可选，指定群ID
 */
router.get('/api/statistics/user-ranking', authMiddleware, async (req, res) => {
  try {
    const { limit, groupId } = req.query;
    
    const limitNum = limit ? parseInt(limit as string) : 10;
    if (isNaN(limitNum) || limitNum <= 0) {
      return res.status(400).json({
        code: 400,
        message: 'limit 必须是正整数',
        data: null
      });
    }

    let groupIdNum: number | undefined;
    if (groupId) {
      const parsed = parseInt(groupId as string);
      if (isNaN(parsed)) {
        return res.status(400).json({
          code: 400,
          message: 'groupId 必须是数字',
          data: null
        });
      }
      groupIdNum = parsed;
    }

    const result = groupIdNum !== undefined 
      ? await statisticsService.getUserMessageRanking(limitNum, groupIdNum)
      : await statisticsService.getUserMessageRanking(limitNum);

    res.status(200).json({
      code: 200,
      message: '获取用户消息排行榜成功',
      data: result
    });
  } catch (error) {
    console.error('获取用户消息排行榜失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取用户消息排行榜失败',
      data: null
    });
  }
});

/**
 * 获取消息时间分布（24小时）
 * GET /api/statistics/hourly-distribution
 * 需要认证
 * 
 * @param groupId - 可选，指定群ID
 */
router.get('/api/statistics/hourly-distribution', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.query;

    let groupIdNum: number | undefined;
    if (groupId) {
      const parsed = parseInt(groupId as string);
      if (isNaN(parsed)) {
        return res.status(400).json({
          code: 400,
          message: 'groupId 必须是数字',
          data: null
        });
      }
      groupIdNum = parsed;
    }

    const result = groupIdNum !== undefined 
      ? await statisticsService.getHourlyMessageDistribution(groupIdNum)
      : await statisticsService.getHourlyMessageDistribution();

    res.status(200).json({
      code: 200,
      message: '获取消息时间分布成功',
      data: result
    });
  } catch (error) {
    console.error('获取消息时间分布失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取消息时间分布失败',
      data: null
    });
  }
});

/**
 * 获取所有群ID列表
 * GET /api/statistics/groups
 * 需要认证
 */
router.get('/api/statistics/groups', authMiddleware, async (req, res) => {
  try {
    const repo = AppDataSource.getRepository(GroupChat);
    const groups = await repo.find({
      select: ['group_id', 'name', 'member_count']
    });
    const filteredGroups = groups.filter(group => {
      return checkWhitelistBlacklist('group', Number(group.group_id));
    });

    res.status(200).json({
      code: 200,
      message: '获取群列表成功',
      data: filteredGroups
    });
  } catch (error) {
    console.error('获取群列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取群列表失败',
      data: null
    });
  }
});

export default router;