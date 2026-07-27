import napcat from "../napcat/index.js";
import { messageService } from "../db/services/MessageServices.js";
import { logger } from "../logger.js";
import { getConfig } from "../config/index.js";
import { Simplified_Message } from "../server/utils/suanq_types.js";
import { self_id } from "../napcat/main.js";

async function convertSimplifiedToNapcat(messages: Simplified_Message[keyof Simplified_Message][], group_id: number): Promise<any[]> {
    const result: any[] = [];

    for (const msg of messages) {
        switch (msg.type) {
            case 'image':
                result.push({
                    type: 'image',
                    data: {
                        file: msg.data.url,
                    }
                });
                break;
            case 'file':
            case 'video':
            case 'record':
                break;
            default:
                result.push(msg);
                break;
        }
    }

    return result;
}

async function sendMediaMessages(messages: Simplified_Message[keyof Simplified_Message][], group_id: number, target_group_id: number) {
    for (const msg of messages) {
        try {
            switch (msg.type) {
                case 'file':
                    
                    // await napcat.send_group_msg({
                    //     group_id: target_group_id,
                    //     message: [{
                    //         type: 'file',
                    //         data: {
                    //             file: msg.data.url,
                    //         }
                    //     }]
                    // });
                    
                    break;
                case 'video':
                    // await napcat.send_group_msg({
                    //     group_id: target_group_id,
                    //     message: [{
                    //         type: 'video',
                    //         data: {
                    //             file: msg.data.url,
                    //         }
                    //     }]
                    // });
                    break;
                case 'record':
                    await napcat.send_group_msg({
                        group_id: target_group_id,
                        message: [{
                            type: 'record',
                            data: {
                                file: msg.data.url,
                            }
                        }]
                    });
                    break;
            }
        } catch (error) {
            logger.error(`发送媒体消息失败: ${error}`);
        }
    }
}

export async function forwardRecallMessage(groupid: number, messageid: number) {
  const message = await messageService.getGroupMessageById(messageid);
  if (!message) {
    logger.error(`未找到消息 ${messageid}`);
    return;
  }
  try {
    const forwardContent = await convertSimplifiedToNapcat(message.message, message.group_id);
    const targetGroupId = getConfig().helper?.admins_group || groupid;

    await napcat.send_group_forward_msg({
    group_id: targetGroupId,
    message: [
        {
            type: "node",
            data: {
                user_id: String(self_id),
                nickname: '撤回记录',
                content: [
                    {
                        type: 'text',
                        data: {
                            text:  '群号:'+String(message.group_id)
                        }
                    }
                ]
            }
        },
        {
            type: "node",
            data: {
                user_id: String(message.user_id),
                nickname: message.sender.nickname+"("+message.sender.user_id+")",
                content: forwardContent,
            }
        }
    ]
  });

    await sendMediaMessages(message.message, message.group_id, targetGroupId);
  } catch (error) {
    logger.error(`发送消息 ${messageid} 失败: ${error}`);
  }
}