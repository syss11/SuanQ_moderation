import { Repository } from 'typeorm';
import { AppDataSource, HumanVerification } from '../database.js';
import type { HumanVerificationEntity } from '../database.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../logger.js';

export class HumanVerificationService {
  private verificationRepo: Repository<HumanVerificationEntity>;

  constructor() {
    this.verificationRepo = AppDataSource.getRepository(HumanVerification);
  }

  /**
   * 创建新的验证记录
   */
  async createVerification(data: {
    user_id: number;
    group_id: number;
    key: string;
    expected_answer: string;
  }): Promise<HumanVerificationEntity> {
    try {
      const verification = this.verificationRepo.create({
        user_id: data.user_id,
        group_id: data.group_id,
        key: data.key,
        expected_answer: data.expected_answer,
        retry_times: 0,
        status: 'pending'
      });
      return await this.verificationRepo.save(verification);
    } catch (error) {
      logger.error('创建验证记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户的待验证记录
   */
  async getPendingVerification(userId: number, group_id: number): Promise<HumanVerificationEntity | null> {
    try {
      return await this.verificationRepo.findOne({
        where: {
          user_id: userId,
          group_id: group_id,
          status: 'pending'
        },
        order: {
          created_at: 'DESC'
        }
      });
    } catch (error) {
      logger.error('获取验证记录失败:', error);
      return null;
    }
  }

  /**
   * 更新验证记录
   */
  async updateVerification(id: number, data: {
    user_answer?: string;
    status: 'passed' | 'failed';
    retry_times?: number;
  }): Promise<boolean> {
    try {
      const result = await this.verificationRepo.update(id, data);
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新验证记录失败:', error);
      return false;
    }
  }

  /**
   * 增加重试次数
   */
  async incrementRetryTimes(id: number): Promise<boolean> {
    try {
      const result = await this.verificationRepo.increment(
        { id },
        'retry_times',
        1
      );
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('增加重试次数失败:', error);
      return false;
    }
  }

  /**
   * 检查用户是否需要验证
   */
  async needsVerification(userId: number, group_id: number): Promise<boolean> {
    try {
      const pendingVerification = await this.getPendingVerification(userId, group_id);
      return pendingVerification !== null;
    } catch (error) {
      logger.error('检查验证状态失败:', error);
      return false;
    }
  }

  /**
   * 获取验证失败的次数
   */
  async getFailedCount(userId: number, group_id: number): Promise<number> {
    try {
      const count = await this.verificationRepo.count({
        where: {
          user_id: userId,
          group_id: group_id,
          status: 'failed'
        }
      });
      return count;
    } catch (error) {
      logger.error('获取失败次数失败:', error);
      return 0;
    }
  }

  /**
   * 通过用户ID和群ID更新验证记录
   */
  async updateVerificationByUser(userId: number, group_id: number, data: {
    user_answer?: string;
    status: 'passed' | 'failed';
    retry_times?: number;
  }): Promise<boolean> {
    try {
      const result = await this.verificationRepo.update(
        {
          user_id: userId,
          group_id: group_id,
          status: 'pending'
        },
        data
      );
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新验证记录失败:', error);
      return false;
    }
  }

  
}

export const humanVerificationService = new HumanVerificationService();
