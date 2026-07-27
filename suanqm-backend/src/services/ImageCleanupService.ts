import { AppDataSource } from '../db/database.js';
import { Image } from '../db/entities/Image.js';
import { logger } from '../logger.js';
import { LessThan } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageCleanupService {
  private IMAGE_SAVE_PATH = path.join(__dirname, '../../public/images');

  /**
   * 清理过期图片
   * @param retentionDays 保留天数
   */
  async cleanupExpiredImages(retentionDays: number): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        logger.warn('数据库未初始化，跳过图片清理');
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const imageRepo = AppDataSource.getRepository(Image);

      // 查询过期图片
      const expiredImages = await imageRepo.find({
        where: {
          created_at: LessThan(cutoffDate)
        }
      });

      if (expiredImages.length === 0) {
        logger.log(`✅ 图片清理完成: 没有需要清理的过期图片`);
        return;
      }

      let deletedFromDb = 0;
      let deletedFiles = 0;
      let failedFiles = 0;

      // 删除文件和数据库记录
      for (const image of expiredImages) {
        try {
          // 删除物理文件
          const filePath = path.join(this.IMAGE_SAVE_PATH, image.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles++;
          }

          // 删除数据库记录
          await imageRepo.remove(image);
          deletedFromDb++;
        } catch (error) {
          failedFiles++;
          logger.error(`删除图片失败: ${image.filename}`, error);
        }
      }

      logger.log(
        `✅ 图片清理完成: 共处理 ${expiredImages.length} 个过期图片, ` +
        `数据库删除 ${deletedFromDb} 条记录, 文件删除 ${deletedFiles} 个, 失败 ${failedFiles} 个`
      );
    } catch (error) {
      logger.error('❌ 图片清理失败:', error);
    }
  }

  /**
   * 清理孤立文件（数据库中没有记录的文件）
   */
  async cleanupOrphanedFiles(): Promise<void> {
    try {
      if (!AppDataSource.isInitialized) {
        logger.warn('数据库未初始化，跳过孤立文件清理');
        return;
      }

      if (!fs.existsSync(this.IMAGE_SAVE_PATH)) {
        logger.warn(`图片目录不存在: ${this.IMAGE_SAVE_PATH}`);
        return;
      }

      const imageRepo = AppDataSource.getRepository(Image);
      
      // 获取所有数据库中的文件名
      const dbImages = await imageRepo.find({
        select: ['filename']
      });
      const dbFilenames = new Set(dbImages.map(img => img.filename));

      // 读取文件系统中的所有文件
      const files = fs.readdirSync(this.IMAGE_SAVE_PATH);
      
      let deletedOrphans = 0;
      for (const file of files) {
        if (!dbFilenames.has(file)) {
          try {
            const filePath = path.join(this.IMAGE_SAVE_PATH, file);
            fs.unlinkSync(filePath);
            deletedOrphans++;
            logger.log(`删除孤立文件: ${file}`);
          } catch (error) {
            logger.error(`删除孤立文件失败: ${file}`, error);
          }
        }
      }

      logger.log(`✅ 孤立文件清理完成: 删除 ${deletedOrphans} 个文件`);
    } catch (error) {
      logger.error('❌ 孤立文件清理失败:', error);
    }
  }
}

export default new ImageCleanupService();
