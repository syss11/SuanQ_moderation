import { AllHandlers } from "node-napcat-ts";
import { SqHandler } from "./adapter.js";
import { messageService } from "../db/services/MessageServices.js";
import napcat from "./index.js";
import { convert_group_message, convert_private_friend_message } from "../server/utils/format_messages.js";
import { checkWhitelistBlacklist, handle_message_start } from "../handler/index.js";
import { getConfig } from "../config/index.js";
import { groupMetaInfo } from "./init.js";
import { userService } from "../db/services/UserService.js";
import { AppDataSource } from "../db/database.js";
let self_id: number=0;
import { logger } from "../logger.js";
import { groupEmojiDislike, groupEmojiLike } from "../handler/interact.js";
import { humanVerificationService } from "../db/services/HumanVerificationService.js";
import { forwardRecallMessage } from "../services/recallhelper.js";

// 创建处理器
export const main_handlers = [
  new SqHandler('message.group', async (context: AllHandlers['message.group']) => {
    if (!checkWhitelistBlacklist('group', context.group_id, context.user_id)) {
      logger.log('[Handler] 消息被黑白名单拦截');
      return;
    }

    const simplifiedGroupMsg = await convert_group_message(context);

    try {
      await messageService.saveGroupMessage(context);
      } catch (error) {
      logger.error('保存群聊消息失败:', error);
    }
    await handle_message_start(simplifiedGroupMsg);
  }),
  
  new SqHandler('message.private.friend', async (context: AllHandlers['message.private.friend']) => {
    if (!checkWhitelistBlacklist('private', undefined, context.user_id)) {
      logger.log('[Handler] 消息被黑白名单拦截');
      return;
    }
    
    const simplifiedFriendMsg = await convert_private_friend_message(context);
    
    try {
      await messageService.savePrivateMessage(context);
      
    } catch (error) {
      logger.error('保存私聊消息失败:', error);
    }await handle_message_start(simplifiedFriendMsg);
  }),

  new SqHandler('notice.group_recall', (context: AllHandlers['notice.group_recall']) => {
    if (!checkWhitelistBlacklist('group', context.group_id, undefined)) {
      logger.log('[Handler] 消息被黑白名单拦截');
      return;
    }
    
    messageService.recallGroupMessage(context.message_id)
      .then((success) => {
        if (success) {
          logger.log(`群聊消息已撤回: ${context.message_id}`);
        } else {
          logger.log(`未找到要撤回的群聊消息: ${context.message_id}`);
        }
      })
      .catch(error => {
        logger.error('撤回群聊消息失败:', error);
      });

    if (getConfig().helper?.recall_preventer.enabled) {
      forwardRecallMessage(context.group_id, context.message_id);
    }

  }),

  new SqHandler('notice.friend_recall', (context: AllHandlers['notice.friend_recall']) => {
    if (!checkWhitelistBlacklist('private', undefined, context.user_id)) {
      logger.log('[Handler] 消息被黑白名单拦截');
      return;
    }
    
    messageService.recallPrivateMessage(context.message_id)
      .then((success) => {
        if (success) {
          logger.log(`私聊消息已撤回: ${context.message_id}`);
        } else {
          logger.log(`未找到要撤回的私聊消息: ${context.message_id}`);
        }
      })
      .catch(error => {
        logger.error('撤回私聊消息失败:', error);
      });
  }),
  new SqHandler('notice.group_increase',async (context: AllHandlers['notice.group_increase']) => {
    if (!checkWhitelistBlacklist('group', context.group_id, undefined)) {
      logger.log('[Handler] 消息被黑白名单拦截');
      return;
    }
    
    logger.log(`[GroupIncrease] 用户 ${context.user_id} 加入群 ${context.group_id}`);
    
    try {
      await groupMetaInfo.ensure_group_users(context.group_id);
      
      if (AppDataSource.isInitialized) {
        const currentCredit = await userService.getUserGroupCredit(context.group_id, context.user_id);
        const config = getConfig();
        const kickThreshold = config.user?.credit?.kick_threshold || -100;
        const defaultCredit = config.user?.credit?.default || 80;
        
        if (currentCredit !== null && currentCredit < kickThreshold) {
          await userService.updateUserGroupCredit(context.group_id, context.user_id, defaultCredit);
          logger.log(`[GroupIncrease] 用户 ${context.user_id} 信誉分 ${currentCredit} 低于阈值 ${kickThreshold}，已重置为 ${defaultCredit}`);
        }
      }

      if (getConfig().rules?.humanVerification?.enabled) {
        const pendingVerification = await humanVerificationService.getPendingVerification(context.user_id, context.group_id);
      if (!pendingVerification) {
        
        let num1Max: number = getConfig().rules?.humanVerification?.maxnum || 100;
        let num2Max: number = getConfig().rules?.humanVerification?.maxnum || 100;

        const num1 = Math.floor(Math.random() * num1Max);
        const num2 = Math.floor(Math.random() * num2Max);
        const expectedAnswer = String(num1 + num2);
        const question = `${num1} + ${num2} = ?`;
        const key = `${Date.now()}-${context.user_id}-${question}`;

        await humanVerificationService.createVerification({
          user_id: context.user_id,
          group_id: context.group_id,
          key: key,
          expected_answer: expectedAnswer
        });

        await napcat.send_group_msg({
          group_id: context.group_id,
          message: [
          {
            type: 'at',
            data: {
              qq: String(context.user_id)
            }
          },
          {
            type: 'text',
            data: {
              text: ` 欢迎加入群聊！请验证：${question} \n你有三次机会，期间不能发言，请直接给出答案！\n若验证失败，你将被移出群聊。`
            }
          }]
        });
        logger.log(`[GroupIncrease] 已为用户 ${context.user_id} 创建验证请求: ${question} = ${expectedAnswer}`);
      } else {
        logger.log(`[GroupIncrease] 用户 ${context.user_id} 已有验证请求，跳过`);
      }
      }
      
    } catch (error) {
      logger.error('同步群成员信息失败:', error);
    }

    
    
  }),
  new SqHandler('notice.group_decrease',async (context: AllHandlers['notice.group_decrease']) => {
    if (!checkWhitelistBlacklist('group', context.group_id, undefined)) {
      logger.log('[Handler] 消息被黑白名单拦截');
      return;
    }
    
    logger.log(`[GroupDecrease] 用户 ${context.user_id} 离开群 ${context.group_id}`);
    
    try {
      await messageService.updateGroupMemberStatus(context.group_id, context.user_id, false);
      logger.log(`[GroupDecrease] 用户 ${context.user_id} 状态已更新为离群`);
    } catch (error) {
      logger.error('更新群成员状态失败:', error);
    }
  }),
  new SqHandler('notice.group_msg_emoji_like',async (context: AllHandlers['notice.group_msg_emoji_like']) => {
    if (!checkWhitelistBlacklist('group', context.group_id, undefined)) {
      logger.log('[Handler] 消息被黑白名单拦截');
      return;
    }
    
    if (context.likes[0].emoji_id=='76'){
      logger.log(`[GroupEmojiLike] 用户 ${context.user_id} 给消息 ${context.message_id} 点赞`);
      await groupEmojiLike(context.user_id, context.group_id, context.message_id);
    }else if (context.likes[0].emoji_id=='38'){
      logger.log(`[GroupEmojiDislike] 用户 ${context.user_id} 给消息 ${context.message_id} 点踩`);
      await groupEmojiDislike(context.user_id, context.group_id, context.message_id);
    }
    
  }),
  
  new SqHandler('meta_event.lifecycle.connect', async (context: AllHandlers['meta_event.lifecycle.connect']) => {
    self_id = context.self_id;


    await groupMetaInfo.init_groups();
    groupMetaInfo.ensure_all_groups_users();

    if (getConfig().debug.enable_tools) {
      if (getConfig().debug.test_groupid) {
        await napcat.send_group_msg({
          group_id: getConfig().debug.test_groupid,
          message: [{
            type: 'text',
            data: {
              text: 'DEBUG:机器人已启动'
            }
          }]
        })
      }
    }
        
    known_robots = getConfig().robot?.custom_robots || [];
    known_robots.push(self_id);
    robot_uin_range= [];

    if (getConfig().robot?.include_official_robot) {
      robot_uin_range = await napcat.get_robot_uin_range(); 
    }
  }),
  new SqHandler('meta_event.lifecycle.disable', async (context: AllHandlers['meta_event.lifecycle.disable']) => {
    console.log('[Handler] 机器人已断开连接');
  }),
];

let known_robots:number[] = [];
let robot_uin_range: {minUin: string;maxUin: string;}[] = [];

export { self_id ,known_robots,robot_uin_range};
