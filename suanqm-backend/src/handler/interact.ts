
import { messageService } from '../db/services/MessageServices.js';
import userInteractionService from '../db/services/UserInteractionService.js';
import { userService } from '../db/services/UserService.js';
import { getConfig } from '../config/index.js';
import { logger } from '../logger.js';
import napcat from '../napcat/index.js';

export async function groupEmojiLike(userid: number, groupid: number, messageid: number) {
  try {
    const canInteract = await userInteractionService.canInteract(userid, groupid);
    if (!canInteract) {
      logger.log(`用户 ${userid} 在群 ${groupid} 交互次数不足`);
      return;
    }

    const message = await messageService.getGroupMessageById(messageid);
    if (!message) {
      logger.log(`消息 ${messageid} 不存在`);
      return;
    }

    if (message.group_id !== groupid) {
      logger.log(`消息 ${messageid} 不属于群 ${groupid}`);
      return;
    }

    const messageTime = message.time;
    const currentTime = Math.floor(Date.now() / 1000);
    const oneDayInSeconds = 24 * 60 * 60;

    if (currentTime - messageTime > oneDayInSeconds) {
      logger.log(`消息 ${messageid} 超过1天,无法互动`);
      return;
    }

    const senderId = message.user_id;
    if (senderId === userid) {
      logger.log(`用户 ${userid} 不能点赞自己的消息`);
      return;
    }

    const interactResult = await userInteractionService.performInteraction(userid, groupid);
    if (!interactResult.success) {
      logger.log(`用户 ${userid} 交互失败: ${interactResult.message}`);
      return;
    }

    const likeAward = getConfig().user?.credit?.like_award || 1;
    const currentCredit = await userService.getUserGroupCredit(groupid, senderId);
    
    if (currentCredit === null) {
      logger.log(`未找到用户 ${senderId} 在群 ${groupid} 的信誉分记录`);
      return;
    }

    const newCredit = Math.min(getConfig().user.credit.max, currentCredit + likeAward);
    await userService.updateUserGroupCredit(groupid, senderId, newCredit);

    logger.log(`用户 ${userid} 在群 ${groupid} 点赞了用户 ${senderId} 的消息 ${messageid}，用户 ${senderId} 获得 ${likeAward} 信誉分，当前信誉分: ${newCredit}`);
    ensureMsgEmojiLikeSet(messageid, '124');
    // await napcat.send_group_msg({
    //   group_id: groupid,
    //   message: [{
    //     type: 'text',
    //     data:{
    //         text: `点赞成功(+${likeAward})`
    //     }
    //   }]
    // })
  } catch (error) {
    logger.error(`点赞处理失败:`, error);
  }
}

export async function groupEmojiDislike(userid: number, groupid: number, messageid: number) {
  try {
    const canInteract = await userInteractionService.canInteract(userid, groupid);
    if (!canInteract) {
      logger.log(`用户 ${userid} 在群 ${groupid} 交互次数不足`);
      return;
    }

    const message = await messageService.getGroupMessageById(messageid);
    if (!message) {
      logger.log(`消息 ${messageid} 不存在`);
      return;
    }

    if (message.group_id !== groupid) {
      logger.log(`消息 ${messageid} 不属于群 ${groupid}`);
      return;
    }

    const messageTime = message.time;
    const currentTime = Math.floor(Date.now() / 1000);
    const oneDayInSeconds = 24 * 60 * 60;

    if (currentTime - messageTime > oneDayInSeconds) {
      logger.log(`消息 ${messageid} 超过1天,无法互动`);
      return;
    }

    const senderId = message.user_id;
    if (senderId === userid) {
      logger.log(`用户 ${userid} 不能点踩自己的消息`);
      return;
    }

    const interactResult = await userInteractionService.performInteraction(userid, groupid);
    if (!interactResult.success) {
      logger.log(`用户 ${userid} 交互失败: ${interactResult.message}`);
      return;
    }

    const dislikePenalty = getConfig().user?.credit?.dislike_penalty || 1;
    const currentCredit = await userService.getUserGroupCredit(groupid, senderId);
    
    if (currentCredit === null) {
      logger.log(`未找到用户 ${senderId} 在群 ${groupid} 的信誉分记录`);
      return;
    }

    const newCredit = Math.max(getConfig().user.credit.kick_threshold, currentCredit - dislikePenalty);
    await userService.updateUserGroupCredit(groupid, senderId, newCredit);

    logger.log(`用户 ${userid} 在群 ${groupid} 点踩了用户 ${senderId} 的消息 ${messageid}，用户 ${senderId} 扣除 ${dislikePenalty} 信誉分，当前信誉分: ${newCredit}`);
    ensureMsgEmojiLikeSet(messageid, '326');
    // await napcat.send_group_msg({
    //   group_id: groupid,
    //   message: [{
    //     type: 'text',
    //     data:{
    //         text: `点踩成功(-${dislikePenalty})`
    //     }
    //   }]
    // })
  } catch (error) {
    logger.error(`点踩处理失败:`, error);
  }
}


const likeCache = new Map<number, string|undefined>();
async function ensureMsgEmojiLikeSet(messageid: number,emoji_id: string) {
  const cachedEmoji = likeCache.get(messageid);
  if (cachedEmoji !== emoji_id) {
    await napcat.set_msg_emoji_like({
      message_id: messageid,
      emoji_id: emoji_id,
      set: true,
    })
    likeCache.set(messageid, emoji_id);
  }else{
    await napcat.set_msg_emoji_like({
      message_id: messageid,
      emoji_id: emoji_id,
      set: false,
    })
    await napcat.set_msg_emoji_like({
      message_id: messageid,
      emoji_id: emoji_id,
      set: true,
    })
    likeCache.set(messageid, undefined);
  }
}