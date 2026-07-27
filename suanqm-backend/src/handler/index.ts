import { getConfig } from "../config/index.js";
import { Simplified_Messages } from "../server/utils/suanq_types";
import { handle_flood_moderation } from "./flood.js";
import actionManager from "./actions.js";
import { self_id } from "../napcat/main.js";
import { checkHumanVerification, handle_commands } from "./commands.js";
import { handle_moderation } from "./moderation.js";
import { logger } from "../logger.js";
import { handleImageBlacklist } from "./image_blacklist.js";
import { handleSensitiveFilter } from "./sensitive.js";
import { callbackManager } from "./callback.js";

interface QueuedMessage {
  message: Simplified_Messages;
  resolve: () => void;
}

class MessageQueue {
  private queue: QueuedMessage[];
  private isProcessing: boolean;
  private delayMs: number;

  constructor(delayMs: number = 200) {
    this.queue = [];
    this.isProcessing = false;
    this.delayMs = delayMs;
  }

  async enqueue(message: Simplified_Messages): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ message, resolve });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      try {
        await this.processMessage(item.message);
      } catch (error) {
        logger.error('处理消息失败:', error);
      }

      item.resolve();

      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
      }
    }

    this.isProcessing = false;
  }

  private async processMessage(message: Simplified_Messages): Promise<void> {
    const tasks: Promise<void>[] = [];
    tasks.push(handle_flood_moderation(message));
    if (getConfig().rules?.moderation?.enabled) {
      tasks.push(handle_moderation(message));
    }
    
    tasks.push(handleImageBlacklist(message));
    tasks.push(handleSensitiveFilter(message));

    await Promise.all(tasks);
    

    await actionManager.execute_all();
    
    actionManager.clear_all();

    
    if (getConfig().enable_commands) {
      await Promise.all([
        handle_commands(message),
        checkHumanVerification(message),
        callbackManager.handle_custom_callback(message)
      ]);
    }


    
  }

  
}

const messageQueue = new MessageQueue(0);

export function checkWhitelistBlacklist(
  message_type: 'group' | 'private',
  group_id?: number,
  user_id?: number
): boolean {
  const config = getConfig().rules?.whitelistBlacklist;
  
  if (!config || !config.enabled) {
    return true;
  }

  const targetId = message_type === 'group' ? group_id : user_id;
  
  if (targetId === undefined) {
    return true;
  }

  const targetList = message_type === 'group' ? config.groups : config.users;
  const targetType = message_type === 'group' ? '群' : '用户';
  
  if (config.mode === 'whitelist') {
    const passed = targetList.includes(targetId);
    return passed;
  } else {
    const passed = !targetList.includes(targetId);
    return passed;
  }
}

export async function handle_message_start(s_message: Simplified_Messages){
  
  if (s_message.user_id === self_id) {
    logger.log('[Handler] 消息来自self');
    return;
  }
  await messageQueue.enqueue(s_message);
}
