import cron, { ScheduledTask } from 'node-cron';
import { AppDataSource } from '../db/database.js';
import { UserInteraction } from '../db/entities/UserInteraction.js';
import { logger } from '../logger.js';
import ImageCleanupService from './ImageCleanupService.js';
import { getConfig } from '../config/index.js';

class DailyResetService {
  private task: ScheduledTask | null = null;

  async resetAllCheckins(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        logger.warn('数据库未初始化，跳过签到次数重置');
        return;
      }

      const interactionRepo = AppDataSource.getRepository(UserInteraction);

      const result = await interactionRepo
        .createQueryBuilder()
        .update(UserInteraction)
        .set({ remaining_checkins: 1 })
        .where('remaining_checkins < 1')
        .execute();

      const affected = result.affected || 0;
      logger.log(`✅ 每日签到次数重置完成: ${affected} 个用户已重置为 1 次`);
    } catch (error) {
      logger.error('❌ 每日签到次数重置失败:', error);
    }
  }

  async resetAllInteractions(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        logger.warn('数据库未初始化，跳过交互次数重置');
        return;
      }

      const interactionRepo = AppDataSource.getRepository(UserInteraction);

      const result = await interactionRepo
        .createQueryBuilder()
        .update(UserInteraction)
        .set({ remaining_interactions: 3 })
        .where('remaining_interactions < 3')
        .execute();

      const affected = result.affected || 0;
      logger.log(`✅ 每日交互次数重置完成: ${affected} 个用户已重置为 3 次`);
    } catch (error) {
      logger.error('❌ 每日交互次数重置失败:', error);
    }
  }

  async cleanupImages(): Promise<void> {
    try {
      const imageCleanupConfig = getConfig().image_cleanup;
      
      if (!imageCleanupConfig?.enabled) {
        logger.log('ℹ️ 图片清理功能未启用');
        return;
      }

      const retentionDays = imageCleanupConfig.retention_days || 30;
      logger.log(`🔄 开始清理 ${retentionDays} 天前的图片...`);
      
      await ImageCleanupService.cleanupExpiredImages(retentionDays);
      await ImageCleanupService.cleanupOrphanedFiles();
    } catch (error) {
      logger.error('❌ 图片清理失败:', error);
    }
  }

  start(): void {
    if (this.task) {
      logger.warn('每日重置任务已经在运行中');
      return;
    }

    const isTestMode = process.env.NODE_ENV === 'test';
    
    if (isTestMode) {
      logger.log('ℹ️ 测试模式，不启动定时任务');
      return;
    }

    this.task = cron.schedule('0 0 * * *', async () => {
      logger.log('🔄 开始执行每日重置任务...');
      await this.resetAllCheckins();
      await this.resetAllInteractions();
      await this.cleanupImages();
    }, {
      timezone: 'Asia/Shanghai'
    });

    logger.log('✅ 每日重置任务已启动 (每天 00:00)');
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.log('⏹️ 每日重置任务已停止');
    }
  }

  async resetNow(): Promise<void> {
    await this.resetAllCheckins();
  }
}

export default new DailyResetService();