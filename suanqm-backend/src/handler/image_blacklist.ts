import { Simplified_Messages } from "../server/utils/suanq_types.js";
import { Image } from "../db/entities/Image.js";
import { AppDataSource } from "../db/database.js";
import napcat from "../napcat/index.js";
import VioPunish from "./vio_punish.js";
import actionManager from "./actions.js";
import { getConfig } from "../config/index.js";
import { save_images_from_message, calculateHammingDistance } from "../napcat/utils.js";
import { PenaltyType, ViolationType } from "../db/entities/Violation.js";
import { send_message_to_chat } from "../character/behavior.js";


import { logger } from "../logger.js";

class ImageBlacklist {
  async isBanned(phash: bigint, threshold: number): Promise<boolean> {
    try {
      const imageRepo = AppDataSource.getRepository(Image);
      const bannedImages = await imageRepo.find({ 
        where: { banned: true },
        select: ['phash']
      });
      
      for (const img of bannedImages) {
        if (img.phash !== null && img.phash !== undefined) {
          const distance = calculateHammingDistance(phash, BigInt(img.phash));
          
          if (distance <= threshold) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      logger.error('[ImageBlacklist] 检查黑名单失败:', error);
      return false;
    }
  }

  async addBlacklist(phash: bigint, reason: string): Promise<boolean> {
    try {
      const imageRepo = AppDataSource.getRepository(Image);
      const image = await imageRepo.findOne({ where: { phash: phash.toString() } });
      
      if (!image) {
        logger.log('[ImageBlacklist] 未找到图片:', phash);
        return false;
      }

      image.banned = true;
      image.ban_reason = reason;
      await imageRepo.save(image);
      
      return true;
    } catch (error) {
      logger.error('[ImageBlacklist] 添加黑名单失败:', error);
      return false;
    }
  }

  async removeBlacklist(phash: bigint): Promise<boolean> {
    try {
      const imageRepo = AppDataSource.getRepository(Image);
      const image = await imageRepo.findOne({ where: { phash: phash.toString() } });
      
      if (!image) {
        return false;
      }

      image.banned = false;
      image.ban_reason = '';
      await imageRepo.save(image);
      
      return true;
    } catch (error) {
      logger.error('[ImageBlacklist] 移除黑名单失败:', error);
      return false;
    }
  }
}

const imageBlacklist = new ImageBlacklist();


export async function handleImageBlacklist(message: Simplified_Messages): Promise<void> {
  if (message.message_type !== 'group') {
    return;
  }

  const config = getConfig();
  const imageBlacklistConfig = config.rules?.imageBlacklist;

  if (!imageBlacklistConfig || !imageBlacklistConfig.enabled) {
    return;
  }
  
  const savedImages = await save_images_from_message(message);
  
  const validImages = savedImages.filter(img => img.success && img.phash !== undefined && img.phash !== null);
  
  if (validImages.length === 0) {
    return;
  }

  const checkPromises = validImages.map(async img => {
    if (img.phash === undefined || img.phash === null) {
      return { img, isBanned: false };
    }
    const isBanned = await imageBlacklist.isBanned(img.phash, imageBlacklistConfig.hammingDistanceThreshold);
    return { img, isBanned };
  });

  const results = await Promise.all(checkPromises);
  const bannedResult = results.find(r => r.isBanned);

  if (bannedResult) {
    try {
      await napcat.delete_msg({
        message_id: message.message_id
      });
      
      actionManager.add_action(
        new VioPunish({
          group_id: message.group_id,
          userid: message.user_id,
          penalty_type: imageBlacklistConfig.penalty.penalty_type,
          penalty_time: 0,
          violation_type: ViolationType.OTHER,
          severity: imageBlacklistConfig.penalty.severity,
          credit_deduction: imageBlacklistConfig.penalty.credit_deduction,
          callback: async () => {
            await send_message_to_chat(message, `该图片已被禁用，信誉分降低`);
          }
        })
      );
      
    } catch (error) {
      logger.error('[ImageBlacklist] 撤回消息失败:', error);
    }
  }
}

export async function addImageBlacklist(phash: bigint, reason: string): Promise<boolean> {
  return await imageBlacklist.addBlacklist(phash, reason);
}

export async function removeImageBlacklist(phash: bigint): Promise<boolean> {
  return await imageBlacklist.removeBlacklist(phash);
}

export { imageBlacklist };
