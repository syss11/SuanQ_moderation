import { AppDataSource, CommandLog } from '../database.js';
import type { CommandLogEntity } from '../database.js';

interface LogCommandParams {
  user_id: number;
  group_id?: number | null;
  command: string;
  params?: Record<string, any> | null;
  is_co_admin?: boolean;
  ruling_cost?: number | null;
  target_user_id?: number | null;
  auth_level?: string | null;
  success?: boolean;
  error_message?: string | null;
  reason?: string | null;
}

class CommandLogService {
  public repository = AppDataSource.getRepository(CommandLog);

  async log(params: LogCommandParams): Promise<CommandLogEntity> {
    const log = this.repository.create({
      user_id: params.user_id,
      group_id: params.group_id ?? null,
      command: params.command,
      params: params.params ? JSON.stringify(params.params) : null,
      is_co_admin: params.is_co_admin ?? false,
      ruling_cost: params.ruling_cost ?? null,
      target_user_id: params.target_user_id ?? null,
      auth_level: params.auth_level ?? null,
      success: params.success ?? true,
      error_message: params.error_message ?? null,
      reason: params.reason ?? null,
    });

    return await this.repository.save(log);
  }

  async addReason(logId: number, reason: string): Promise<CommandLogEntity | null> {
    const log = await this.repository.findOne({ where: { id: logId } });
    if (!log) return null;

    log.reason = reason;
    return await this.repository.save(log);
  }

  async getLogsWithReason(groupId?: number, limit = 50): Promise<CommandLogEntity[]> {
    const where: Record<string, any> = { reason: () => 'log.reason IS NOT NULL' };
    if (groupId !== undefined) {
      where.group_id = groupId;
    }

    return await this.repository.find({
      where,
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getByUserId(userId: number, limit = 50): Promise<CommandLogEntity[]> {
    return await this.repository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getByGroupId(groupId: number, limit = 50): Promise<CommandLogEntity[]> {
    return await this.repository.find({
      where: { group_id: groupId },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getByCommand(command: string, limit = 50): Promise<CommandLogEntity[]> {
    return await this.repository.find({
      where: { command },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getCoAdminLogs(groupId?: number, limit = 50): Promise<CommandLogEntity[]> {
    const where: Record<string, any> = { is_co_admin: true };
    if (groupId !== undefined) {
      where.group_id = groupId;
    }

    return await this.repository.find({
      where,
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getFailedLogs(limit = 50): Promise<CommandLogEntity[]> {
    return await this.repository.find({
      where: { success: false },
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async getStatsByCommand(): Promise<Record<string, number>> {
    const result = await this.repository
      .createQueryBuilder('log')
      .select('log.command', 'command')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.command')
      .getRawMany();

    return result.reduce((acc, row) => {
      acc[row.command] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);
  }

  async getStatsByUser(groupId?: number): Promise<{ user_id: number; count: number }[]> {
    const query = this.repository
      .createQueryBuilder('log')
      .select('log.user_id', 'user_id')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.user_id')
      .orderBy('count', 'DESC');

    if (groupId !== undefined) {
      query.where('log.group_id = :groupId', { groupId });
    }

    return await query.getRawMany();
  }

  async getCoAdminStats(groupId?: number): Promise<{ user_id: number; total_cost: number; count: number }[]> {
    const query = this.repository
      .createQueryBuilder('log')
      .select('log.user_id', 'user_id')
      .addSelect('SUM(log.ruling_cost)', 'total_cost')
      .addSelect('COUNT(*)', 'count')
      .where('log.is_co_admin = :isCoAdmin', { isCoAdmin: true })
      .andWhere('log.ruling_cost IS NOT NULL')
      .groupBy('log.user_id')
      .orderBy('total_cost', 'DESC');

    if (groupId !== undefined) {
      query.andWhere('log.group_id = :groupId', { groupId });
    }

    return await query.getRawMany();
  }

  async deleteOldLogs(days: number): Promise<void> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    await this.repository
      .createQueryBuilder()
      .delete()
      .from(CommandLog)
      .where('created_at < :date', { date })
      .execute();
  }
}

export default new CommandLogService();