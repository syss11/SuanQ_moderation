import { Simplified_Messages } from "../server/utils/suanq_types";
import { getConfig } from "../config/index.js";
import { PenaltyType, ViolationType } from "../db/entities/Violation.js";
import VioPunish from "./vio_punish.js";
import actionManager from "./actions.js";
import { recall_and_forward } from "./actions.js";
import { clean_message_for_ai } from "../character/ai_service.js";
import { FloodConfig } from "../config/config";
import { get_message_hash } from "./utils.js";
import { remind_flood } from "../character/behavior.js";
import { is_robot } from "../napcat/utils.js";
import { messageService } from "../db/services/MessageServices.js";
import { groupMetaInfo } from "../napcat/init.js";
import { logger } from "../logger.js";
import { match_command } from "./commands.js";

function mergekey(groupid: number, userid: number) {
  return `${groupid}-${userid}`;
}

interface UserMessageWindow {
  userId: number;
  info: {
    messageHash: string;
    timestamp: number;
    weight: number;
  }[];
}

class FloodDetector {
  private windows: Map<string, UserMessageWindow>;
  private windowSize: number;
  private maxMessages: number;
  private maxLength: number;
  private penalty: FloodConfig["penalty"];

  constructor(config: FloodConfig) {
    this.windows = new Map();
    this.windowSize = config.windowSize * 1000;
    this.maxMessages = config.maxMessages;
    this.maxLength = config.maxLength;
    this.penalty = config.penalty;
  }

  async detect(message: Simplified_Messages): Promise<boolean> {
    let userId = message.user_id;
    let weight = 1;

    if (message.message_type !== "group") {
      return false;
    }

    let deal_robot = is_robot(userId) && getConfig().rules?.general?.bot_call_amount_to != 0
    if (deal_robot) {
      const lastSenderId = await messageService.getLastNonRobotGroupMessageSender(
        message.group_id,
        message.time,
        30
      );
      if (lastSenderId) {
        userId = lastSenderId;
        weight = getConfig().rules?.general?.bot_call_amount_to || 0;
        // logger.log(`机器人消息，使用上一条非机器人消息发送者: ${lastSenderId}`);
      } else {
        return false;
      }
    }
    
    if (match_command(message)){
      weight += getConfig().rules?.general?.bot_call_amount_to/2 || 0;
      // logger.log(`命令消息`);
    }

    const currentTime = message.time * 1000;

    const messageLength = clean_message_for_ai(message.message, 10000).length;
    const maxLength = this.maxLength || 500;

    let window = this.windows.get(mergekey(message.group_id, userId));

    if (!window) {
      window = {
        userId,
        info: [],
      };
      this.windows.set(mergekey(message.group_id, userId), window);
    }

    const messageHash = get_message_hash(message.raw_message);
    const tooLongAmountTo = getConfig().rules?.general?.too_long_amount_to || 3;

    if (messageLength > maxLength) {
      weight += tooLongAmountTo - 1;

      if (deal_robot){
        recall_and_forward(message, message.group_id, false);
      }else{
        actionManager.add_action(
        new VioPunish({
          group_id:
            message.message_type === "group" ? message.group_id : undefined,
          userid: userId,
          penalty_type: PenaltyType.OTHER,
          penalty_time: 0,
          violation_type: ViolationType.FLOOD_OR_NONSENSE,
          severity: 0,
          credit_deduction: 0,
          callback: async (enable_ai,extra_prompt) => {
            if (message.message_type === "group" && getConfig().ai?.enable && enable_ai) {
              await recall_and_forward(message, message.group_id, enable_ai,extra_prompt);
            }
          },
        }),
      );
      }

      
    }
    const hashes = window.info.map((info) => info.messageHash);
    if (hashes.includes(messageHash)) {
      weight += (getConfig().rules?.general?.identical_amount_to || 1.5) - 1;
    }

    window.info.push({
      messageHash: messageHash,
      timestamp: currentTime,
      weight: weight,
    });

    const windowStart = currentTime - this.windowSize;
    window.info = window.info.filter((ts) => ts.timestamp > windowStart);

    const messageCount = window.info.reduce(
      (sum, info) => sum + info.weight,
      0,
    );

    if (messageCount > this.maxMessages) {
      const penaltyConfig = this.penalty || {
        penalty_type: PenaltyType.MUTE,
        severity: 1,
        credit_deduction: 10,
        penalty_time: 300,
      };

      actionManager.add_action(
        new VioPunish({
          group_id:
            message.message_type === "group" ? message.group_id : undefined,
          userid: userId,
          penalty_type: penaltyConfig.penalty_type,
          penalty_time: penaltyConfig.penalty_time || 0,
          violation_type: ViolationType.FLOOD_OR_NONSENSE,
          severity: penaltyConfig.severity,
          credit_deduction: penaltyConfig.credit_deduction,
          callback: async (enable_ai,extra_prompt) => {
            if (message.message_type === "group" && getConfig().ai?.enable && enable_ai) {
              await remind_flood(message,extra_prompt);
            }
          },
        }),
      );

      return true;
    }

    return false;
  }

  clearUser(userId: number, groupId: number): void {
    this.windows.delete(mergekey(groupId, userId));
  }

  clearAll(): void {
    this.windows.clear();
  }

  getUserMessageCount(userId: number, groupId: number): number {
    const window = this.windows.get(mergekey(groupId, userId));
    if (!window) {
      return 0;
    }

    const currentTime = Date.now();
    const windowStart = currentTime - this.windowSize;
    window.info = window.info.filter((ts) => ts.timestamp > windowStart);

    return window.info.length;
  }
}

const floodConfigs = getConfig().rules?.general?.flood || [];
const detectors = floodConfigs.map((config) => new FloodDetector(config));

async function handle_flood_moderation(message: Simplified_Messages) {
  if (message.message_type === "group" ) {
    const myRole = await groupMetaInfo.get_my_role(message.group_id);
    if (myRole == 'member') {
      logger.log(`[Flood]self不是群管理员，跳过检测`);
      return;
    }

    const senderRole = message.sender.role;
    
    if (senderRole === "owner") {
      return;
      
    }else if (senderRole === "admin" && myRole != "owner") {
        if (!getConfig().robot.custom_robots.includes(message.sender.user_id)) {
          return;
        }
      }
    
    
  }
  await Promise.allSettled(detectors.map(detector => detector.detect(message)));
  
  
}

export { handle_flood_moderation, FloodDetector };
export type { UserMessageWindow };
