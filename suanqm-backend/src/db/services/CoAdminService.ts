import { AppDataSource } from '../database.js';
import { CoAdmin } from '../entities/CoAdmin.js';
import { logger } from '../../logger.js';

class CoAdminService {
  private coAdminRepo = AppDataSource.getRepository(CoAdmin);

  async getByUserId(userId: number, groupId: number): Promise<CoAdmin | null> {
    return await this.coAdminRepo.findOne({
      where: { user_id: userId, group_id: groupId }
    });
  }

  async getById(id: number): Promise<CoAdmin | null> {
    return await this.coAdminRepo.findOne({
      where: { id }
    });
  }

  async getAll(): Promise<CoAdmin[]> {
    return await this.coAdminRepo.find({
      order: { created_at: 'DESC' }
    });
  }

  async getAllByGroup(groupId: number): Promise<CoAdmin[]> {
    return await this.coAdminRepo.find({
      where: { group_id: groupId },
      order: { created_at: 'DESC' }
    });
  }

  async getAllActive(): Promise<CoAdmin[]> {
    return await this.coAdminRepo.find({
      where: { status: true },
      order: { created_at: 'DESC' }
    });
  }

  async getAllActiveByGroup(groupId: number): Promise<CoAdmin[]> {
    return await this.coAdminRepo.find({
      where: { group_id: groupId, status: true },
      order: { created_at: 'DESC' }
    });
  }

  async create(userId: number, groupId: number, options: { status?: boolean; max_ruling?: number; ruling?: number } = {}): Promise<CoAdmin> {
    const coAdmin = this.coAdminRepo.create({
      user_id: userId,
      group_id: groupId,
      status: options.status ?? true,
      max_ruling: options.max_ruling ?? 50,
      ruling: options.ruling ?? 50
    });
    await this.coAdminRepo.save(coAdmin);
    logger.log(`创建协管: userId=${userId}, groupId=${groupId}`);
    return coAdmin;
  }

  async update(userId: number, groupId: number, updates: Partial<Pick<CoAdmin, 'status' | 'max_ruling' | 'ruling'>>): Promise<boolean> {
    const result = await this.coAdminRepo.update(
      { user_id: userId, group_id: groupId },
      updates
    );
    if ((result.affected || 0) > 0) {
      logger.log(`更新协管: userId=${userId}, groupId=${groupId}, updates=${JSON.stringify(updates)}`);
    }
    return (result.affected || 0) > 0;
  }

  async updateById(id: number, updates: Partial<Pick<CoAdmin, 'user_id' | 'group_id' | 'status' | 'max_ruling' | 'ruling'>>): Promise<boolean> {
    const result = await this.coAdminRepo.update(
      { id },
      updates
    );
    if ((result.affected || 0) > 0) {
      logger.log(`更新协管: id=${id}, updates=${JSON.stringify(updates)}`);
    }
    return (result.affected || 0) > 0;
  }

  async delete(userId: number, groupId: number): Promise<boolean> {
    const result = await this.coAdminRepo.delete({ user_id: userId, group_id: groupId });
    if ((result.affected || 0) > 0) {
      logger.log(`删除协管: userId=${userId}, groupId=${groupId}`);
    }
    return (result.affected || 0) > 0;
  }

  async deleteById(id: number): Promise<boolean> {
    const result = await this.coAdminRepo.delete({ id });
    if ((result.affected || 0) > 0) {
      logger.log(`删除协管: id=${id}`);
    }
    return (result.affected || 0) > 0;
  }

  async incrementRuling(userId: number, groupId: number, amount: number = 1): Promise<number | null> {
    const coAdmin = await this.getByUserId(userId, groupId);
    if (!coAdmin) {
      return null;
    }
    coAdmin.ruling += amount;
    await this.coAdminRepo.save(coAdmin);
    logger.log(`增加裁决点: userId=${userId}, groupId=${groupId}, amount=${amount}, current=${coAdmin.ruling}`);
    return coAdmin.ruling;
  }

  async decrementRuling(userId: number, groupId: number, amount: number = 1): Promise<number | null> {
    const coAdmin = await this.getByUserId(userId, groupId);
    if (!coAdmin) {
      return null;
    }
    coAdmin.ruling = Math.max(0, coAdmin.ruling - amount);
    await this.coAdminRepo.save(coAdmin);
    logger.log(`减少裁决点: userId=${userId}, groupId=${groupId}, amount=${amount}, current=${coAdmin.ruling}`);
    return coAdmin.ruling;
  }

  async resetRuling(userId: number, groupId: number): Promise<boolean> {
    return await this.update(userId, groupId, { ruling: 0 });
  }

  async setStatus(userId: number, groupId: number, status: boolean): Promise<boolean> {
    return await this.update(userId, groupId, { status });
  }

  async setMaxRuling(userId: number, groupId: number, maxRuling: number): Promise<boolean> {
    return await this.update(userId, groupId, { max_ruling: maxRuling });
  }

  async isCoAdmin(userId: number, groupId: number): Promise<boolean> {
    const coAdmin = await this.getByUserId(userId, groupId);
    return coAdmin !== null && coAdmin.status;
  }

  
  async getRemainingRuling(userId: number, groupId: number): Promise<number | null> {
    const coAdmin = await this.getByUserId(userId, groupId);
    if (!coAdmin) {
      return null;
    }
    return Math.max(0, coAdmin.ruling);
  }
}

export default new CoAdminService();