import { Simplified_Messages } from "../server/utils/suanq_types.js";
import { PenaltyType, ViolationType } from "../db/entities/Violation.js";
import VioPunish from "./vio_punish.js";
import actionManager from "./actions.js";
import { getConfig } from "../config/index.js";
import { send_message_to_chat } from "../character/behavior.js";
import { logger } from "../logger.js";
import { sensitiveFilter } from "../services/filter.js";
import { clean_message_for_ai } from "../character/ai_service.js";
import napcat from "../napcat/index.js";
import { forwardRecallMessage } from "../services/recallhelper.js";

export async function handleSensitiveFilter(message: Simplified_Messages): Promise<void> {
  if (message.message_type !== 'group') {
    return;
  }

  const config = getConfig();
  const sensitiveConfig = config.rules?.sensitive;

  if (!sensitiveConfig || !sensitiveConfig.enabled) {
    return;
  }

  const messageText = clean_message_for_ai(message.message);
  if (!messageText) {
    return;
  }
 
  const result = sensitiveFilter.verify(messageText);
  if (result.matched) {
    try {
      const penaltyConfig = sensitiveConfig.penalties.find(p => p.severity === result.severity);
      if (!penaltyConfig) {
        logger.warn(`[Sensitive] 未找到严重程度 ${result.severity} 的惩罚配置，使用默认值`);
      }

      const penalty = penaltyConfig || {
        severity: 1,
        penalty: {
          penalty_type: PenaltyType.MUTE,
          credit_deduction: 10,
          penalty_time: 300
        }
      };

          actionManager.add_action(
        new VioPunish({
          group_id: message.group_id,
          userid: message.user_id,
          penalty_type: penalty.penalty.penalty_type,
          penalty_time: penalty.penalty.penalty_time || 0,
          violation_type: ViolationType.OTHER,
          severity: penalty.severity,
          credit_deduction: penalty.penalty.credit_deduction || 0,
          callback: async () => {
            await send_message_to_chat(message, `包含敏感内容，已执行「${penalty.penalty.penalty_type}」处罚`);
            if (getConfig().helper?.recall_preventer.enabled) {
              await forwardRecallMessage(message.group_id, message.message_id);
            }
            await napcat.delete_msg({
              message_id: message.message_id
            });

          }
        })
      );
      
      logger.log(`[Sensitive] 用户 ${message.user_id} 在群 ${message.group_id} 发送敏感词消息，严重程度：${result.severity}`);
    } catch (error) {
      logger.error('[Sensitive] 处理敏感词失败:', error);
    }
  }
}
