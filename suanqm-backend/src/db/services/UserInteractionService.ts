import { AppDataSource } from '../database.js';
import { UserInteraction } from '../entities/UserInteraction.js';
import { logger } from '../../logger.js';

class UserInteractionService {
  private interactionRepo = AppDataSource.getRepository(UserInteraction);

  async getOrCreateInteraction(userId: number, groupId: number): Promise<UserInteraction> {
    let interaction = await this.interactionRepo.findOne({
      where: { user_id: userId, group_id: groupId }
    });

    if (!interaction) {
      interaction = this.interactionRepo.create({
        user_id: userId,
        group_id: groupId,
        remaining_checkins: 1,
        remaining_interactions: 3
      });
      await this.interactionRepo.save(interaction);
      logger.log(`为用户 ${userId} 在群 ${groupId} 创建交互记录`);
    }

    return interaction;
  }

  async getInteraction(userId: number, groupId: number): Promise<UserInteraction | null> {
    return await this.interactionRepo.findOne({
      where: { user_id: userId, group_id: groupId }
    });
  }

  async getRemainingCheckins(userId: number, groupId: number): Promise<number> {
    const interaction = await this.getOrCreateInteraction(userId, groupId);
    return interaction.remaining_checkins;
  }

  async canCheckin(userId: number, groupId: number): Promise<boolean> {
    const interaction = await this.getOrCreateInteraction(userId, groupId);
    
    if (interaction.remaining_checkins <= 0) {
      return false;
    }

    const today = new Date().toISOString().split('T')[0];
    if (interaction.last_checkin_date === today) {
      return false;
    }

    return true;
  }

  async performCheckin(userId: number, groupId: number): Promise<{ success: boolean; remaining: number; message: string }> {
    const interaction = await this.getOrCreateInteraction(userId, groupId);

    if (interaction.remaining_checkins <= 0) {
      return {
        success: false,
        remaining: 0,
        message: '已经签到过了'
      };
    }

    interaction.remaining_checkins -= 1;
    interaction.last_checkin_date = new Date().toISOString().split('T')[0];
    await this.interactionRepo.save(interaction);

    logger.log(`用户 ${userId} 在群 ${groupId} 签到成功，剩余次数: ${interaction.remaining_checkins}`);

    return {
      success: true,
      remaining: interaction.remaining_checkins,
      message: '签到成功'
    };
  }

  async resetCheckins(userId: number, groupId: number, count: number = 3): Promise<void> {
    const interaction = await this.getOrCreateInteraction(userId, groupId);
    interaction.remaining_checkins = count;
    await this.interactionRepo.save(interaction);
    logger.log(`重置用户 ${userId} 在群 ${groupId} 的签到次数为 ${count}`);
  }

  async resetAllCheckinsForGroup(groupId: number, count: number = 3): Promise<number> {
    const result = await this.interactionRepo
      .createQueryBuilder()
      .update(UserInteraction)
      .set({ remaining_checkins: count })
      .where('group_id = :groupId', { groupId })
      .execute();

    logger.log(`重置群 ${groupId} 所有用户的签到次数为 ${count}`);
    return result.affected || 0;
  }

  async initializeForGroupMembers(groupId: number, memberIds: number[]): Promise<void> {
    for (const memberId of memberIds) {
      await this.getOrCreateInteraction(memberId, groupId);
    }
    logger.log(`为群 ${groupId} 的 ${memberIds.length} 个成员初始化交互记录`);
  }

  async getAllInteractions(): Promise<UserInteraction[]> {
    return await this.interactionRepo.find();
  }

  async getInteractionsByGroup(groupId: number): Promise<UserInteraction[]> {
    return await this.interactionRepo.find({
      where: { group_id: groupId }
    });
  }

  async getInteractionsByUser(userId: number): Promise<UserInteraction[]> {
    return await this.interactionRepo.find({
      where: { user_id: userId }
    });
  }

  async getRemainingInteractions(userId: number, groupId: number): Promise<number> {
    const interaction = await this.getOrCreateInteraction(userId, groupId);
    return interaction.remaining_interactions;
  }

  async canInteract(userId: number, groupId: number): Promise<boolean> {
    const interaction = await this.getOrCreateInteraction(userId, groupId);
    
    if (interaction.remaining_interactions <= 0) {
      return false;
    }

    return true;
  }

  async performInteraction(userId: number, groupId: number): Promise<{ success: boolean; remaining: number; message: string }> {
    const interaction = await this.getOrCreateInteraction(userId, groupId);

    if (interaction.remaining_interactions <= 0) {
      return {
        success: false,
        remaining: 0,
        message: '交互次数已用完'
      };
    }

    interaction.remaining_interactions -= 1;
    await this.interactionRepo.save(interaction);

    logger.log(`用户 ${userId} 在群 ${groupId} 交互成功，剩余次数: ${interaction.remaining_interactions}`);

    return {
      success: true,
      remaining: interaction.remaining_interactions,
      message: '交互成功'
    };
  }

  async resetInteractions(userId: number, groupId: number, count: number = 3): Promise<void> {
    const result = await this.interactionRepo
      .createQueryBuilder()
      .update(UserInteraction)
      .set({ remaining_interactions: count })
      .where('user_id = :userId AND group_id = :groupId', { userId, groupId })
      .execute();

    logger.log(`重置用户 ${userId} 在群 ${groupId} 的交互次数为 ${count}`);
  }

  async resetAllInteractionsForGroup(groupId: number, count: number = 3): Promise<number> {
    const result = await this.interactionRepo
      .createQueryBuilder()
      .update(UserInteraction)
      .set({ remaining_interactions: count })
      .where('group_id = :groupId', { groupId })
      .execute();

    logger.log(`重置群 ${groupId} 所有用户的交互次数为 ${count}`);
    return result.affected || 0;
  }
}

export default new UserInteractionService();