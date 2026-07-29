import { Repository, LessThan } from 'typeorm';
import { AppDataSource, Image } from '../database.js';
import type { ImageEntity } from '../database.js';
import { logger } from '../../logger.js';

export class ImageService {
  private imageRepo: Repository<ImageEntity>;

  constructor() {
    this.imageRepo = AppDataSource.getRepository(Image);
  }

  async findById(id: number): Promise<ImageEntity | null> {
    return this.imageRepo.findOne({ where: { id } });
  }

  async findByMd5(md5: string): Promise<ImageEntity | null> {
    return this.imageRepo.findOne({ where: { md5 } });
  }

  async findByMessageId(messageId: number): Promise<ImageEntity | null> {
    return this.imageRepo.findOne({ where: { message_id: messageId } });
  }

  async findByPhash(phash: string): Promise<ImageEntity | null> {
    return this.imageRepo.findOne({ where: { phash } });
  }

  async getBannedPhashes(): Promise<string[]> {
    const images = await this.imageRepo.find({
      where: { banned: true },
      select: ['phash']
    });
    return images
      .map(img => img.phash)
      .filter((phash): phash is string => phash !== null && phash !== undefined);
  }

  async paginatedFind(
    banned: boolean,
    page: number,
    pageSize: number
  ): Promise<{ images: ImageEntity[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const [images, total] = await this.imageRepo.findAndCount({
      where: { banned },
      order: { created_at: 'DESC' },
      take: pageSize,
      skip: offset
    });
    return { images, total };
  }

  async banImage(id: number, reason: string): Promise<ImageEntity | null> {
    const image = await this.findById(id);
    if (!image) return null;
    image.banned = true;
    image.ban_reason = reason;
    return this.imageRepo.save(image);
  }

  async unbanImage(id: number): Promise<ImageEntity | null> {
    const image = await this.findById(id);
    if (!image) return null;
    image.banned = false;
    image.ban_reason = null;
    return this.imageRepo.save(image);
  }

  async banImageByPhash(phash: string, reason: string): Promise<boolean> {
    const image = await this.findByPhash(phash);
    if (!image) {
      logger.log('[ImageService] 未找到图片:', phash);
      return false;
    }
    image.banned = true;
    image.ban_reason = reason;
    await this.imageRepo.save(image);
    return true;
  }

  async unbanImageByPhash(phash: string): Promise<boolean> {
    const image = await this.findByPhash(phash);
    if (!image) return false;
    image.banned = false;
    image.ban_reason = '';
    await this.imageRepo.save(image);
    return true;
  }

  async removeById(id: number): Promise<boolean> {
    const image = await this.findById(id);
    if (!image) return false;
    await this.imageRepo.remove(image);
    return true;
  }

  async remove(image: ImageEntity): Promise<void> {
    await this.imageRepo.remove(image);
  }

  async save(image: ImageEntity): Promise<ImageEntity> {
    return this.imageRepo.save(image);
  }

  async getAllFilenames(): Promise<string[]> {
    const images = await this.imageRepo.find({ select: ['filename'] });
    return images.map(img => img.filename);
  }

  async findExpiredImages(retentionDays: number): Promise<ImageEntity[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    return this.imageRepo.find({
      where: { created_at: LessThan(cutoffDate) }
    });
  }

  async removeImages(images: ImageEntity[]): Promise<void> {
    for (const image of images) {
      try {
        await this.imageRepo.remove(image);
      } catch (error) {
        logger.error(`删除图片数据库记录失败: ${image.filename}`, error);
      }
    }
  }
}
