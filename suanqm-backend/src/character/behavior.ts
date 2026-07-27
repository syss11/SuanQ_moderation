import { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { callAIWithRetry, clean_message_for_ai } from './ai_service.js';
import { profileManager } from './profile.js';
import napcat from '../napcat/index.js'
import { Simplified_Messages } from "../server/utils/suanq_types.js";
import { ViolationType } from '../db/entities/Violation.js';
import { logger } from '../logger.js';



async function call_ai_api(messages: ChatCompletionMessageParam[],max_tokens:number,temperature:number,useCase:'chat'|'moderation'='chat'):Promise<string>{
    return await callAIWithRetry(messages, max_tokens, temperature, useCase);
}

export async function send_message_to_chat(message: Simplified_Messages,response:string) {
    
    const cleanedResponse = response.replace(/\n+/g, ' ').trim();
    try {

        if (message.message_type=='group') {
            await napcat.send_group_msg({
                group_id: message.group_id,
                message: [{
                    type: 'text',
                    data: {
                        text: cleanedResponse
                    }
                }]
            })
        }else if (message.message_type=='private'){
            await napcat.send_private_msg({
                user_id: message.user_id,
                message: [{
                    type: 'text',
                    data: {
                        text: cleanedResponse
                    }
                }]
            })
        }
    } catch (error) {
        logger.error('发送消息到聊天失败:', error);
    }
}

export async function remind_recall_and_forward(message: Simplified_Messages,extra_prompt?:string){
    const character_profile = profileManager.getActiveProfile()
    if (!character_profile) {
        logger.error('没有选中角色配置');
        return;
    }

    call_ai_api([
        {
            role: 'system',
            content: character_profile.prompt.personality+'\n'+character_profile.prompt.reply_style
        },
        {
            role: 'user',
            content: `用户${message.sender.nickname}:${clean_message_for_ai(message.message,100)}`
        },
        {
            role:"system",
            content:character_profile.prompt.on_remind_recall_forward+'数据：'+(extra_prompt?extra_prompt:'')
        }
    ],64,0.7).then(async (response) => {
        await send_message_to_chat(message,response)
    })
}


export async function remind_flood(message: Simplified_Messages,extra_prompt?:string){
    const character_profile = profileManager.getActiveProfile()
    if (!character_profile) {
        logger.error('没有选中角色配置');
        return;
    }

    call_ai_api([
        {
            role: 'system',
            content: character_profile.prompt.personality+'\n'+character_profile.prompt.reply_style
        },
        {
            role: 'user',
            content: `用户${message.sender.nickname}:${clean_message_for_ai(message.message,20)}`
        },
        {
            role:"system",
            content:character_profile.prompt.on_remind_flood+'数据：'+(extra_prompt?extra_prompt:'')
        }
    ],64,0.7).then(async (response) => {
        await send_message_to_chat(message,response)
    })
}

export async function remind_violation(message: Simplified_Messages,result: { id: string; violation: boolean; severity: number; violation_type: ViolationType; reason: string },extra_prompt?:string){
    const character_profile = profileManager.getActiveProfile()
    if (!character_profile) {
        logger.error('没有选中角色配置');
        return;
    }

    call_ai_api([
        {
            role: 'system',
            content: character_profile.prompt.personality+'\n'+character_profile.prompt.reply_style
        },
        {
            role: 'user',
            content: `用户${message.sender.nickname}:${clean_message_for_ai(message.message,20)}`
        },
        {
            role:"system",
            content:character_profile.prompt.on_remind_violation.replace('{violation_type}',result.violation_type).replace('{reason}',result.reason)+'注意：'+(extra_prompt?extra_prompt:'')
        }
    ],64,0.5).then(async (response) => {
        await send_message_to_chat(message,response)
    })
}   