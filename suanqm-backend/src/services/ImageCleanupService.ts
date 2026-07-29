import { ImageService } from '../db/services/ImageService.js';
import { logger } from '../logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ImageCleanupService {
  private IMAGE_SAVE_PATH = path.join(__dirname, '../../public/images');
  private imageService = new ImageService();

  async cleanupExpiredImages(retentionDays: number): Promise<void> {
    try {
      const expiredImages = await this.imageService.findExpiredImages(retentionDays);

      if (expiredImages.length === 0) {
        logger.log(`✅ 图片清理完成: 没有需要清理的过期图片`);
        return;
      }

      let deletedFromDb = 0;
      let deletedFiles = 0;
      let failedFiles = 0;

      for (const image of expiredImages) {
        try {
          const filePath = path.join(this.IMAGE_SAVE_PATH, image.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles++;
          }

          await this.imageService.remove(image);
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

  async cleanupOrphanedFiles(): Promise<void> {
    try {
      if (!fs.existsSync(this.IMAGE_SAVE_PATH)) {
        logger.warn(`图片目录不存在: ${this.IMAGE_SAVE_PATH}`);
        return;
      }

      const dbFilenames = new Set(await this.imageService.getAllFilenames());

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
