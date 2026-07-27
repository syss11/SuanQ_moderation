import { Repository, FindOptionsWhere } from 'typeorm';
import { AppDataSource } from '../database.js';
import { Violation, ViolationType, PenaltyType, ViolationStatus } from '../entities/Violation.js';
import { logger } from '../../logger.js';

export interface CreateViolationOptions {
  user_id: number;
  time: number;
  violation_type: ViolationType;
  severity?: number;
  credit_change: number;
  penalty_type?: PenaltyType;
  penalty_time?: number;
  description?: string;
}

export class ViolationService {
  private violationRepo: Repository<Violation>;

  constructor() {
    this.violationRepo = AppDataSource.getRepository(Violation);
  }

  /**
   * 创建违规记录
   */
  async createViolation(options: CreateViolationOptions): Promise<Violation | null> {
    try {
      const violation = this.violationRepo.create({
        user_id: options.user_id,
        time: options.time,
        violation_type: options.violation_type,
        severity: options.severity,
        credit_change: options.credit_change,
        penalty_type: options.penalty_type || null,
        penalty_time: options.penalty_time || null,
        status: ViolationStatus.ACTIVE,
        description: options.description || null
      });

      return await this.violationRepo.save(violation);
    } catch (error) {
      logger.error('创建违规记录失败:', error);
      return null;
    }
  }

  /**
   * 根据ID查询违规记录
   */
  async getViolationById(id: number): Promise<Violation | null> {
    try {
      return await this.violationRepo.findOne({ where: { id } });
    } catch (error) {
      logger.error('查询违规记录失败:', error);
      return null;
    }
  }

  /**
   * 根据用户ID查询违规记录
   */
  async getViolationsByUserId(user_id: number, options: {
    limit?: number;
    offset?: number;
    status?: ViolationStatus;
  } = {}): Promise<{ violations: Violation[]; total: number }> {
    try {
      const { limit = 50, offset = 0, status } = options;

      const where: FindOptionsWhere<Violation> = { user_id };
      if (status) {
        where.status = status;
      }

      const [violations, total] = await this.violationRepo.findAndCount({
        where,
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset
      });

      return { violations, total };
    } catch (error) {
      logger.error('查询用户违规记录失败:', error);
      return { violations: [], total: 0 };
    }
  }

  /**
   * 根据违规类型查询记录
   */
  async getViolationsByType(violation_type: ViolationType, options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{ violations: Violation[]; total: number }> {
    try {
      const { limit = 50, offset = 0 } = options;

      const [violations, total] = await this.violationRepo.findAndCount({
        where: { violation_type },
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset
      });

      return { violations, total };
    } catch (error) {
      logger.error('根据违规类型查询记录失败:', error);
      return { violations: [], total: 0 };
    }
  }

  /**
   * 更新违规记录状态
   */
  async updateViolationStatus(id: number, status: ViolationStatus): Promise<boolean> {
    try {
      const result = await this.violationRepo.update(
        { id },
        { status }
      );

      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新违规记录状态失败:', error);
      return false;
    }
  }

  /**
   * 更新违规记录
   */
  async updateViolation(id: number, updates: Partial<Violation>): Promise<boolean> {
    try {
      const result = await this.violationRepo.update(
        { id },
        updates
      );

      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新违规记录失败:', error);
      return false;
    }
  }

  /**
   * 删除违规记录
   */
  async deleteViolation(id: number): Promise<boolean> {
    try {
      const result = await this.violationRepo.delete({ id });

      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('删除违规记录失败:', error);
      return false;
    }
  }

  /**
   * 获取用户在指定时间范围内的违规记录
   */
  async getUserViolationsInTimeRange(
    user_id: number,
    startTime: number,
    endTime: number
  ): Promise<Violation[]> {
    try {
      return await this.violationRepo
        .createQueryBuilder('violation')
        .where('violation.user_id = :user_id', { user_id })
        .andWhere('violation.time >= :startTime', { startTime })
        .andWhere('violation.time <= :endTime', { endTime })
        .orderBy('violation.time', 'DESC')
        .getMany();
    } catch (error) {
      logger.error('查询用户时间范围内违规记录失败:', error);
      return [];
    }
  }

  /**
   * 获取用户在指定时间范围内的违规次数
   */
  async getUserViolationCountInTimeRange(
    user_id: number,
    startTime: number,
    endTime: number,
    violation_type?: ViolationType
  ): Promise<number> {
    try {
      const query = this.violationRepo
        .createQueryBuilder('violation')
        .where('violation.user_id = :user_id', { user_id })
        .andWhere('violation.time >= :startTime', { startTime })
        .andWhere('violation.time <= :endTime', { endTime });

      if (violation_type) {
        query.andWhere('violation.violation_type = :violation_type', { violation_type });
      }

      return await query.getCount();
    } catch (error) {
      logger.error('查询用户时间范围内违规次数失败:', error);
      return 0;
    }
  }

  /**
   * 获取用户总信誉分变化
   */
  async getUserTotalCreditChange(user_id: number): Promise<number> {
    try {
      const result = await this.violationRepo
        .createQueryBuilder('violation')
        .select('SUM(violation.credit_change)', 'total')
        .where('violation.user_id = :user_id', { user_id })
        .getRawOne();

      return result?.total || 0;
    } catch (error) {
      logger.error('查询用户总信誉分变化失败:', error);
      return 0;
    }
  }

  /**
   * 获取所有违规记录
   */
  async getAllViolations(options: {
    limit?: number;
    offset?: number;
    status?: ViolationStatus;
    violation_type?: ViolationType;
  } = {}): Promise<{ violations: Violation[]; total: number }> {
    try {
      const { limit = 50, offset = 0, status, violation_type } = options;

      const where: FindOptionsWhere<Violation> = {};
      if (status) {
        where.status = status;
      }
      if (violation_type) {
        where.violation_type = violation_type;
      }

      const [violations, total] = await this.violationRepo.findAndCount({
        where,
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset
      });

      return { violations, total };
    } catch (error) {
      logger.error('获取所有违规记录失败:', error);
      return { violations: [], total: 0 };
    }
  }

  /**
   * 批量更新违规记录状态
   */
  async batchUpdateViolationStatus(ids: number[], status: ViolationStatus): Promise<number> {
    try {
      const result = await this.violationRepo.update(
        ids,
        { status }
      );

      return result.affected || 0;
    } catch (error) {
      logger.error('批量更新违规记录状态失败:', error);
      return 0;
    }
  }
}

export const violationService = new ViolationService();