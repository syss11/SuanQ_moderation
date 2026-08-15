import { Repository } from 'typeorm';
import { AppDataSource, Suppression } from '../database.js';
import type { SuppressionEntity } from '../database.js';
import { logger } from '../../logger.js';

export interface SuppressionApiModel {
  id: number;
  user_id: number;
  group_id: number;
  status: boolean;
  set_at: number;          // unix 秒
  calculated_at: number;   // unix 秒
  energy: number;
  max_energy: number;
  regen_per_second: number; // 每秒恢复点数
  period: number;           // 压制持续秒数；负数表示不限时长
  remaining_sec: number;    // 距离结束剩余秒数；-1 表示不限时长，0 表示已结束/未启用
  created_at: number;       // unix 秒
  updated_at: number;       // unix 秒
}

const DEFAULTS = {
  max_energy: 40,
  energy: 40,
  regen_per_second: 0,
  period: 86400,           // 默认 1 天（秒）
};

export class SuppressionService {
  private suppressionRepo: Repository<SuppressionEntity>;

  constructor() {
    this.suppressionRepo = AppDataSource.getRepository(Suppression);
  }

  // ================================================================
  // 工具：秒 <-> 毫秒 互转
  // ================================================================
  private static secToMs(sec: number): number {
    return Math.floor(sec * 1000);
  }
  private static msToSec(ms: number): number {
    return Math.floor(ms / 1000);
  }
  private static nowSec(): number {
    return Math.floor(Date.now() / 1000);
  }

  // ================================================================
  // 有效期判定（内部仍用毫秒精度计算，API 暴露秒）
  // period < 0 视为「不限时长」，永不过期
  // ================================================================

  /**
   * 判断压制记录是否已过期
   * 公式：结束时间（毫秒）= set_at + period * 1000
   * 特殊：period < 0 表示不限时长，永不过期
   */
  isExpired(suppression: SuppressionEntity, nowMs: number = Date.now()): boolean {
    if (suppression.period < 0) return false;
    const endsAt = suppression.set_at + suppression.period * 1000;
    return nowMs >= endsAt;
  }

  /**
   * 是否为不限时长压制
   */
  isUnlimited(suppression: SuppressionEntity): boolean {
    return suppression.period < 0;
  }

  /**
   * 距离压制结束还有多少毫秒
   *  - 未过期为正数，已过期为 0
   *  - 不限时长返回 Infinity
   */
  getRemainingMs(suppression: SuppressionEntity, nowMs: number = Date.now()): number {
    if (suppression.period < 0) return Infinity;
    const endsAt = suppression.set_at + suppression.period * 1000;
    return Math.max(0, endsAt - nowMs);
  }

  /**
   * 距离压制结束还有多少秒（对外 API 用，整数向下取整）
   *  - 不限时长返回 -1（API 层据此识别）
   */
  getRemainingSec(suppression: SuppressionEntity, nowSec?: number): number {
    if (suppression.period < 0) return -1;
    const nowMs = nowSec !== undefined ? SuppressionService.secToMs(nowSec) : Date.now();
    return Math.floor(this.getRemainingMs(suppression, nowMs) / 1000);
  }

  /**
   * 懒计算当前真实 energy（基于 calculated_at -> now 的差值秒数 * regen_per_second）
   * 只计算不落库
   */
  private calcCurrentEnergy(suppression: SuppressionEntity, nowMs: number): number {
    const elapsedSec = Math.max(0, (nowMs - suppression.calculated_at) / 1000);
    let energy = suppression.energy + elapsedSec * suppression.regen_per_second;
    if (energy > suppression.max_energy) energy = suppression.max_energy;
    // 负值允许累计，不归零（禁言后从负值慢慢恢复到 0，再升到 max_energy）
    return energy;
  }

  // ================================================================
  // 实体 -> API 模型转换（所有时间字段统一秒）
  // ================================================================

  toApiModel(entity: SuppressionEntity): SuppressionApiModel {
    const nowMs = Date.now();
    let remainingSec: number;
    if (!entity.status) {
      remainingSec = 0;
    } else if (entity.period < 0) {
      remainingSec = -1; // 不限时长
    } else {
      remainingSec = Math.floor(this.getRemainingMs(entity, nowMs) / 1000);
    }
    return {
      id: entity.id,
      user_id: entity.user_id,
      group_id: entity.group_id,
      status: entity.status,
      set_at: SuppressionService.msToSec(entity.set_at),
      calculated_at: SuppressionService.msToSec(entity.calculated_at),
      energy: entity.energy,
      max_energy: entity.max_energy,
      regen_per_second: entity.regen_per_second,
      period: entity.period,            // 秒；负数表示不限时长
      remaining_sec: remainingSec,      // 秒；-1 表示不限时长
      created_at: SuppressionService.msToSec(entity.created_at.getTime()),
      updated_at: SuppressionService.msToSec(entity.updated_at.getTime()),
    };
  }

  toApiList(entities: SuppressionEntity[]): SuppressionApiModel[] {
    return entities.map((e) => this.toApiModel(e));
  }

  // ================================================================
  // 写操作
  // ================================================================

  /**
   * 添加或更新压制记录（按 user_id + group_id 唯一键 upsert）
   * 所有时间参数统一秒：
   *   - setAtSec：压制开始 unix 时间戳（秒），缺省为当前时间
   *   - periodSec：压制持续时长（秒），缺省 86400（1 天）
   * 若已存在则覆盖传入字段，未传的保持原值；此时 setAt 会刷新（除非明确传相同值）
   */
  async upsert(
    userId: number,
    groupId: number,
    data: {
      status?: boolean;
      energy?: number;
      max_energy?: number;
      regen_per_second?: number;
      periodSec?: number;
      setAtSec?: number;
    } = {},
  ): Promise<SuppressionEntity> {
    try {
      const existing = await this.getSuppression(userId, groupId);

      // 参数默认值
      const maxEnergy = data.max_energy ?? existing?.max_energy ?? DEFAULTS.max_energy;
      const energy = data.energy ?? existing?.energy ?? Math.min(DEFAULTS.energy, maxEnergy);
      const regen = data.regen_per_second ?? existing?.regen_per_second ?? DEFAULTS.regen_per_second;
      const periodSec = data.periodSec ?? existing?.period ?? DEFAULTS.period;

      // 秒 -> 毫秒
      const nowMs = Date.now();
      const setAtMs = data.setAtSec !== undefined
        ? SuppressionService.secToMs(data.setAtSec)
        : nowMs;

      if (existing) {
        existing.status = data.status ?? existing.status;
        existing.max_energy = maxEnergy;
        existing.energy = Math.min(energy, existing.max_energy === maxEnergy ? maxEnergy : maxEnergy);
        existing.energy = Math.max(0, Math.min(energy, maxEnergy));
        existing.regen_per_second = regen;
        existing.period = periodSec;
        existing.set_at = setAtMs;
        existing.calculated_at = setAtMs; // 起点对齐，保证能量从新的 setAt 开始算
        const saved = await this.suppressionRepo.save(existing);
        logger.log(
          `更新压制: userId=${userId}, groupId=${groupId}, energy=${saved.energy}/${saved.max_energy}, period=${saved.period}s`,
        );
        return saved;
      }

      const suppression = this.suppressionRepo.create({
        user_id: userId,
        group_id: groupId,
        status: data.status ?? true,
        set_at: setAtMs,
        calculated_at: setAtMs,
        energy: Math.max(0, Math.min(energy, maxEnergy)),
        max_energy: maxEnergy,
        regen_per_second: regen,
        period: periodSec,
      });
      const saved = await this.suppressionRepo.save(suppression);
      logger.log(
        `创建压制: userId=${userId}, groupId=${groupId}, energy=${saved.energy}/${saved.max_energy}, period=${saved.period}s`,
      );
      return saved;
    } catch (error) {
      logger.error('upsert 压制记录失败:', error);
      throw error;
    }
  }

  /**
   * 续期（秒单位）
   *  - addPeriodSec：在现有 period 基础上加 N 秒（可负；可导致 period 变为负数 = 不限时长）
   *  - newPeriodSec：直接把 period 改成新的秒数（传负数 = 不限时长）
   *  - resetSetAt：true 时把 set_at 重设为 now；默认只要修改了 period 就会重设
   */
  async renew(
    userId: number,
    groupId: number,
    options: { addPeriodSec?: number; resetSetAt?: boolean; newPeriodSec?: number } = {},
  ): Promise<SuppressionEntity | null> {
    try {
      const suppression = await this.getSuppression(userId, groupId);
      if (!suppression) return null;

      const nowMs = Date.now();

      if (options.newPeriodSec !== undefined) {
        suppression.period = options.newPeriodSec; // 允许负数（不限时长）
      } else if (options.addPeriodSec !== undefined) {
        suppression.period = suppression.period + options.addPeriodSec; // 允许跨过 0 变为负数
      }

      const shouldReset =
        options.resetSetAt === true ||
        (options.resetSetAt !== false &&
          (options.newPeriodSec !== undefined || options.addPeriodSec !== undefined));
      if (shouldReset) {
        suppression.set_at = nowMs;
      }

      // 续期顺便刷新 calculated_at，把之前积累的能量结算掉
      const trueEnergy = this.calcCurrentEnergy(suppression, nowMs);
      suppression.energy = trueEnergy;
      suppression.calculated_at = nowMs;

      const saved = await this.suppressionRepo.save(suppression);
      logger.log(`续期压制: userId=${userId}, groupId=${groupId}, period=${saved.period}s`);
      return saved;
    } catch (error) {
      logger.error('续期压制失败:', error);
      return null;
    }
  }

  // ================================================================
  // 读操作
  // ================================================================

  async getSuppression(userId: number, groupId: number): Promise<SuppressionEntity | null> {
    try {
      return await this.suppressionRepo.findOne({
        where: { user_id: userId, group_id: groupId },
      });
    } catch (error) {
      logger.error('查询压制记录失败:', error);
      return null;
    }
  }

  /**
   * 判断用户在群内是否处于被压制状态（纯布尔，业务判断直接用）
   * 1. 查 (user, group)，无记录或 status=false → 未压制（false）
   * 2. status=true → 用 set_at + period 秒判定过期；过期则把 status 改 false 落库并返回 false
   * 3. 未过期 → true
   */
  async isSuppressed(userId: number, groupId: number): Promise<boolean> {
    try {
      const suppression = await this.suppressionRepo.findOne({
        where: { user_id: userId, group_id: groupId },
        select: ['id', 'status', 'set_at', 'period'],
      });

      if (!suppression) return false;
      if (!suppression.status) return false;

      const nowMs = Date.now();
      if (this.isExpired(suppression, nowMs)) {
        suppression.status = false;
        try {
          await this.suppressionRepo.save(suppression);
          logger.log(`压制已过期自动关闭: userId=${userId}, groupId=${groupId}`);
        } catch (e) {
          logger.error('关闭过期压制记录失败:', e);
        }
        return false;
      }
      return true;
    } catch (error) {
      logger.error('判断压制状态失败:', error);
      return false;
    }
  }

  /**
   * 查询当前有效的压制：status=true 且未过期（秒 API 用请配合 toApiModel）
   * 若记录 status=true 但已过期，自动把 status 置 false 落库后返回 null
   */
  async getEffectiveSuppression(userId: number, groupId: number): Promise<SuppressionEntity | null> {
    try {
      const suppression = await this.suppressionRepo.findOne({
        where: { user_id: userId, group_id: groupId, status: true },
      });
      if (!suppression) return null;

      const nowMs = Date.now();
      if (this.isExpired(suppression, nowMs)) {
        suppression.status = false;
        try {
          await this.suppressionRepo.save(suppression);
          logger.log(`压制已过期自动关闭: userId=${userId}, groupId=${groupId}`);
        } catch (e) {
          logger.error('关闭过期压制记录失败:', e);
        }
        return null;
      }
      return suppression;
    } catch (error) {
      logger.error('查询有效压制记录失败:', error);
      return null;
    }
  }

  /** 兼容 */
  async getActiveSuppression(userId: number, groupId: number): Promise<SuppressionEntity | null> {
    return this.getEffectiveSuppression(userId, groupId);
  }

  async getById(id: number): Promise<SuppressionEntity | null> {
    try {
      return await this.suppressionRepo.findOne({ where: { id } });
    } catch (error) {
      logger.error('按 ID 查询压制记录失败:', error);
      return null;
    }
  }

  async getByGroup(groupId: number): Promise<SuppressionEntity[]> {
    try {
      return await this.suppressionRepo.find({
        where: { group_id: groupId },
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      logger.error('查询群压制记录失败:', error);
      return [];
    }
  }

  /** 查询某群有效压制（status=true 且未过期）；过期的记录顺便置 status=false */
  async getEffectiveByGroup(groupId: number): Promise<SuppressionEntity[]> {
    try {
      const list = await this.suppressionRepo.find({
        where: { group_id: groupId, status: true },
        order: { created_at: 'DESC' },
      });
      const nowMs = Date.now();
      const effective: SuppressionEntity[] = [];
      const expiredUpdates: SuppressionEntity[] = [];
      for (const s of list) {
        if (this.isExpired(s, nowMs)) {
          s.status = false;
          expiredUpdates.push(s);
        } else {
          effective.push(s);
        }
      }
      if (expiredUpdates.length) {
        try {
          await this.suppressionRepo.save(expiredUpdates);
          logger.log(`群 ${groupId} 有 ${expiredUpdates.length} 条压制记录过期自动关闭`);
        } catch (e) {
          logger.error('批量关闭过期压制记录失败:', e);
        }
      }
      return effective;
    } catch (error) {
      logger.error('查询群有效压制记录失败:', error);
      return [];
    }
  }

  /** 兼容 */
  async getActiveByGroup(groupId: number): Promise<SuppressionEntity[]> {
    return this.getEffectiveByGroup(groupId);
  }

  async getByUser(userId: number): Promise<SuppressionEntity[]> {
    try {
      return await this.suppressionRepo.find({
        where: { user_id: userId },
        order: { created_at: 'DESC' },
      });
    } catch (error) {
      logger.error('查询用户压制记录失败:', error);
      return [];
    }
  }

  async getAll(options: { page?: number; pageSize?: number } = {}): Promise<{
    suppressions: SuppressionEntity[];
    total: number;
  }> {
    try {
      const { page = 1, pageSize = 50 } = options;
      const [suppressions, total] = await this.suppressionRepo.findAndCount({
        order: { created_at: 'DESC' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      });
      return { suppressions, total };
    } catch (error) {
      logger.error('查询全部压制记录失败:', error);
      return { suppressions: [], total: 0 };
    }
  }

  // ================================================================
  // 状态 / 删除
  // ================================================================

  async setStatus(userId: number, groupId: number, status: boolean): Promise<boolean> {
    try {
      const result = await this.suppressionRepo.update(
        { user_id: userId, group_id: groupId },
        { status },
      );
      const ok = (result.affected || 0) > 0;
      if (ok) {
        logger.log(`修改压制状态: userId=${userId}, groupId=${groupId}, status=${status}`);
      }
      return ok;
    } catch (error) {
      logger.error('修改压制状态失败:', error);
      return false;
    }
  }

  async setStatusById(id: number, status: boolean): Promise<boolean> {
    try {
      const result = await this.suppressionRepo.update({ id }, { status });
      const ok = (result.affected || 0) > 0;
      if (ok) {
        logger.log(`修改压制状态: id=${id}, status=${status}`);
      }
      return ok;
    } catch (error) {
      logger.error('按 ID 修改压制状态失败:', error);
      return false;
    }
  }

  /**
   * 直接更新字段（不含 energy 懒计算）
   * setAtSec：传入秒，内部转毫秒
   */
  async update(
    userId: number,
    groupId: number,
    updates: {
      status?: boolean;
      max_energy?: number;
      regen_per_second?: number;
      periodSec?: number;
      setAtSec?: number;
    },
  ): Promise<boolean> {
    try {
      const payload: Record<string, any> = {};
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.max_energy !== undefined) payload.max_energy = updates.max_energy;
      if (updates.regen_per_second !== undefined) payload.regen_per_second = updates.regen_per_second;
      if (updates.periodSec !== undefined) payload.period = updates.periodSec;
      if (updates.setAtSec !== undefined) payload.set_at = SuppressionService.secToMs(updates.setAtSec);

      if (Object.keys(payload).length === 0) return false;

      const result = await this.suppressionRepo.update(
        { user_id: userId, group_id: groupId },
        payload,
      );
      const ok = (result.affected || 0) > 0;
      if (ok) {
        logger.log(`更新压制: userId=${userId}, groupId=${groupId}, updates=${JSON.stringify(payload)}`);
      }
      return ok;
    } catch (error) {
      logger.error('更新压制记录失败:', error);
      return false;
    }
  }

  async remove(userId: number, groupId: number): Promise<boolean> {
    try {
      const result = await this.suppressionRepo.delete({
        user_id: userId,
        group_id: groupId,
      });
      const ok = (result.affected || 0) > 0;
      if (ok) {
        logger.log(`删除压制: userId=${userId}, groupId=${groupId}`);
      }
      return ok;
    } catch (error) {
      logger.error('删除压制记录失败:', error);
      return false;
    }
  }

  async removeById(id: number): Promise<boolean> {
    try {
      const result = await this.suppressionRepo.delete({ id });
      const ok = (result.affected || 0) > 0;
      if (ok) {
        logger.log(`删除压制: id=${id}`);
      }
      return ok;
    } catch (error) {
      logger.error('按 ID 删除压制记录失败:', error);
      return false;
    }
  }

  // ================================================================
  // Energy 相关（calculated_at 懒计算基准；所有计算基于秒差值；对外结果不含单位歧义）
  // ================================================================

  /**
   * 获取当前 energy（懒计算 + 落库刷新 calculated_at & energy）
   */
  async getEnergy(userId: number, groupId: number): Promise<number | null> {
    try {
      const suppression = await this.getEffectiveSuppression(userId, groupId);
      if (!suppression) return null;

      const nowMs = Date.now();
      const newEnergy = this.calcCurrentEnergy(suppression, nowMs);
      suppression.calculated_at = nowMs;
      suppression.energy = newEnergy;
      await this.suppressionRepo.save(suppression);
      return newEnergy;
    } catch (error) {
      logger.error('获取压制 energy 失败:', error);
      return null;
    }
  }

  /**
   * 扣除 energy（cost 单位：点数）
   * 允许透支：energy 可被扣成负数（用于上层计算禁言时长 = |负值| * 10 秒）
   * 负值会保留并在 calcCurrentEnergy 中随 regen 慢慢恢复（不会被硬归零）。
   *  - success=true：扣减完成，remainingEnergy 可能为负
   *  - success=false：压制无效 / 异常，remainingEnergy=null
   */
  async consumeEnergy(
    userId: number,
    groupId: number,
    cost: number,
  ): Promise<{ success: boolean; remainingEnergy: number | null }> {
    try {
      if (cost < 0) return { success: false, remainingEnergy: null };

      const suppression = await this.getEffectiveSuppression(userId, groupId);
      if (!suppression) return { success: false, remainingEnergy: null };

      const nowMs = Date.now();
      const currentEnergy = this.calcCurrentEnergy(suppression, nowMs);

      suppression.calculated_at = nowMs;
      suppression.energy = currentEnergy - cost; // 允许透支为负，负值保留累计
      await this.suppressionRepo.save(suppression);
      return { success: true, remainingEnergy: suppression.energy };
    } catch (error) {
      logger.error('消费压制 energy 失败:', error);
      return { success: false, remainingEnergy: null };
    }
  }

  /** 补充 energy（管理用），上限 max_energy */
  async addEnergy(userId: number, groupId: number, amount: number): Promise<number | null> {
    try {
      const suppression = await this.getSuppression(userId, groupId);
      if (!suppression) return null;

      const nowMs = Date.now();
      let currentEnergy = this.calcCurrentEnergy(suppression, nowMs);
      currentEnergy = Math.max(0, Math.min(suppression.max_energy, currentEnergy + amount));

      suppression.calculated_at = nowMs;
      suppression.energy = currentEnergy;
      await this.suppressionRepo.save(suppression);
      logger.log(`补充压制 energy: userId=${userId}, groupId=${groupId}, amount=${amount}, current=${suppression.energy}`);
      return suppression.energy;
    } catch (error) {
      logger.error('补充压制 energy 失败:', error);
      return null;
    }
  }

  /** 重置 energy = max_energy，刷新 calculated_at */
  async resetEnergy(userId: number, groupId: number): Promise<number | null> {
    try {
      const suppression = await this.getSuppression(userId, groupId);
      if (!suppression) return null;

      suppression.calculated_at = Date.now();
      suppression.energy = suppression.max_energy;
      await this.suppressionRepo.save(suppression);
      logger.log(`重置压制 energy: userId=${userId}, groupId=${groupId}, energy=${suppression.energy}`);
      return suppression.energy;
    } catch (error) {
      logger.error('重置压制 energy 失败:', error);
      return null;
    }
  }
}

export const suppressionService = new SuppressionService();
