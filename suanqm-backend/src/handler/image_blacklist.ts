import { Simplified_Messages } from "../server/utils/suanq_types.js";
import { ImageService } from "../db/services/ImageService.js";
import napcat from "../napcat/index.js";
import VioPunish from "./vio_punish.js";
import actionManager from "./actions.js";
import { getConfig } from "../config/index.js";
import { save_images_from_message, calculateHammingDistance } from "../napcat/utils.js";
import { PenaltyType, ViolationType } from "../db/database.js";
import { send_message_to_chat } from "../character/behavior.js";
import { logger } from "../logger.js";

class ImageBlacklist {
  private imageService = new ImageService();

  async isBanned(phash: bigint, threshold: number): Promise<boolean> {
    try {
      const bannedPhashes = await this.imageService.getBannedPhashes();
      
      for (const bannedPhash of bannedPhashes) {
        const distance = calculateHammingDistance(phash, BigInt(bannedPhash));
        
        if (distance <= threshold) {
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error('[ImageBlacklist] 检查黑名单失败:', error);
      return false;
    }
  }

  async addBlacklist(phash: bigint, reason: string): Promise<boolean> {
    return await this.imageService.banImageByPhash(phash.toString(), reason);
  }

  async removeBlacklist(phash: bigint): Promise<boolean> {
    return await this.imageService.unbanImageByPhash(phash.toString());
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
