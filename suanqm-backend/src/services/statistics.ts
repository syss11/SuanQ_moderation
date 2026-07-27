import { AppDataSource, dbType } from '../db/database.js';
import { GroupMessage } from '../db/entities/index.js';

export interface MessageTrendItem {
  date: string;
  count: number;
}

export interface UserRankingItem {
  user_id: number;
  nickname: string;
  count: number;
}

export interface HourlyDistributionItem {
  hour: number;
  count: number;
}

export interface StatisticsService {
  getMessageTrend(period: 'day' | 'week' | 'month', count: number, groupId?: number): Promise<MessageTrendItem[]>;
  getUserMessageRanking(limit: number, groupId?: number): Promise<UserRankingItem[]>;
  getHourlyMessageDistribution(groupId?: number): Promise<HourlyDistributionItem[]>;
}

const periodConfig = {
  day: {
    format: '%Y-%m-%d',
    groupBy: 'date',
    multiplier: 1
  },
  week: {
    format: '%Y-%W',
    groupBy: 'week',
    multiplier: 7
  },
  month: {
    format: '%Y-%m',
    groupBy: 'month',
    multiplier: 30
  }
};

export const statisticsService: StatisticsService = {
  async getMessageTrend(period: 'day' | 'week' | 'month', count: number, groupId?: number): Promise<MessageTrendItem[]> {
    const config = periodConfig[period];
    const repo = AppDataSource.getRepository(GroupMessage);
    const now = Math.floor(Date.now() / 1000);
    const startTime = now - count * config.multiplier * 24 * 60 * 60;

    let dateSelect: string;
    if (dbType === 'mysql') {
      dateSelect = `DATE_FORMAT(FROM_UNIXTIME(gm.time), '${config.format}')`;
    } else {
      dateSelect = `strftime('${config.format}', gm.time, 'unixepoch')`;
    }

    let query = repo
      .createQueryBuilder('gm')
      .select(dateSelect, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('gm.time >= :startTime', { startTime })
      .groupBy('date')
      .orderBy('date', 'ASC');

    if (groupId !== undefined) {
      query = query.andWhere('gm.group_id = :groupId', { groupId });
    }

    const result = await query.getRawMany();
    
    return result.map(item => ({
      date: item.date,
      count: parseInt(item.count)
    }));
  },

  async getUserMessageRanking(limit: number, groupId?: number): Promise<UserRankingItem[]> {
    const repo = AppDataSource.getRepository(GroupMessage);

    let query = repo
      .createQueryBuilder('gm')
      .select('gm.user_id', 'user_id')
      .addSelect('MAX(gm.sender->>"$.nickname")', 'nickname')
      .addSelect('COUNT(*)', 'count')
      .groupBy('gm.user_id')
      .orderBy('count', 'DESC')
      .limit(limit);

    if (groupId !== undefined) {
      query = query.where('gm.group_id = :groupId', { groupId });
    }

    const result = await query.getRawMany();
    
    return result.map(item => ({
      user_id: parseInt(item.user_id),
      nickname: item.nickname || '未知用户',
      count: parseInt(item.count)
    }));
  },

  async getHourlyMessageDistribution(groupId?: number): Promise<HourlyDistributionItem[]> {
    const repo = AppDataSource.getRepository(GroupMessage);

    let hourSelect: string;
    if (dbType === 'mysql') {
      hourSelect = "DATE_FORMAT(FROM_UNIXTIME(gm.time), '%H')";
    } else {
      hourSelect = "strftime('%H', gm.time, 'unixepoch')";
    }

    let query = repo
      .createQueryBuilder('gm')
      .select(hourSelect, 'hour')
      .addSelect('COUNT(*)', 'count')
      .groupBy('hour')
      .orderBy('hour', 'ASC');

    if (groupId !== undefined) {
      query = query.where('gm.group_id = :groupId', { groupId });
    }

    const result = await query.getRawMany();
    
    const distribution: HourlyDistributionItem[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0
    }));

    result.forEach(item => {
      const hour = parseInt(item.hour);
      distribution[hour].count = parseInt(item.count);
    });

    return distribution;
  }
};