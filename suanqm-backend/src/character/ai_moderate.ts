import { Simplified_Message } from "../server/utils/suanq_types.js";
import { ViolationType } from "../db/entities/Violation.js";
import { callAIWithRetry } from "./ai_service.js";
import { ChatCompletionMessageParam } from "openai/resources/index.js";
import { getConfig } from "../config/index.js";
import { logger } from "../logger.js";

export function message_to_aitext(messages: Simplified_Message[keyof Simplified_Message][],max_length:number = 150): string {
    const textParts: string[] = [];
    
    for (const msg of messages) {
        switch (msg.type) {
            case 'text':
                if (msg.data.text) {
                    textParts.push(msg.data.text);
                }
                break;
            case 'at':
                const qq = msg.data.qq;
                if (qq !== 'all') {
                    textParts.push(`@${qq}`);
                }else{
                    textParts.push('@全体成员');
                }
                break;
            case 'reply':
                const msgid = msg.data.id;
                textParts.push(`[回复 ${msgid}]`);
                break;
            case 'image':
                textParts.push('[图片]');
                break;
            case 'file':
                textParts.push('[文件]');
                break;
            case 'video':
                textParts.push('[视频]');
                break;
            case 'forward':
                textParts.push('[转发] ['+message_to_aitext(msg.data.content as Simplified_Message[keyof Simplified_Message][],max_length)+']');
                break;
            case 'json':
                textParts.push('[JSON数据]');
                break;
            case 'markdown':
                if (msg.data.content) {
                    textParts.push(msg.data.content);
                }
                break;
            case 'face':
            case 'poke':
            case 'dice':
            case 'rps':
                textParts.push('[互动]');
                break;
            default:
                break;
        }
    }
    
    let cleanedText = textParts.join(' ');
    
    cleanedText = cleanedText
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    if (cleanedText.length === 0) {
        return '[内容已过滤]';
    }
    
    return cleanedText.length > max_length ? cleanedText.substring(0, max_length)+'...' : cleanedText;
}


export type AIresult = {
    id: string;
    violation: boolean;
    severity: number;
    violation_type: ViolationType;
    reason: string;
}

export async function ai_moderate(messages: { id: string; text: string }[], max_tokens: number = 256): Promise<AIresult[]> {
    if (messages.length === 0) {
        return [];
    }

    logger.log('[AI Moderation] 待审核消息数量:', messages.length);
    
    try {
        const messagesList = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: `请审核以下 ${messages.length} 条消息：\n\n${messages.map((msg, index) => `{"id":"${msg.id}","msg":"${msg.text}"}`).join('\n')}`
            },
            {
                role: 'system',
                content: rejectPromptInjection
            }
        ];
        
        const response = await callAIWithRetry(messagesList as ChatCompletionMessageParam[], 1024, 0.3, 'moderation');
        
        let parsed: any[];
        try {
            parsed = JSON.parse(response);
            if (!Array.isArray(parsed)) {
                throw new Error('AI 返回的不是数组');
            }
            if (parsed.length !== messages.length) {
                logger.warn(`[AI Moderation] 返回结果数量(${parsed.length})与输入数量(${messages.length})不一致`);
            }
        } catch (e) {
            logger.error('[AI Moderation] 解析 AI 响应失败:', response);
            parsed = messages.map(msg => ({
                violation: false,
                severity: 0,
                violation_type: ViolationType.OTHER,
                reason: 'AI 响应解析失败'
            }));
        }
        
        const results: AIresult[] = parsed.map((item: any, index: number) => ({
            id: messages[index].id,
            violation: item.violation || false,
            severity: item.severity || 0,
            violation_type: item.violation_type.toLowerCase() as ViolationType || ViolationType.OTHER,
            reason: item.reason || '无'
        }));
        
        logger.log('[AI Moderation] 审核完成，违规数量:', results.filter(r => r.violation).length);
        return results;
        
    } catch (error) {
        logger.error('[AI Moderation] 审核消息失败:', error);
        return messages.map(msg => ({
            id: msg.id,
            violation: false,
            severity: 0,
            violation_type: ViolationType.OTHER,
            reason: '审核失败'
        }));
    }
}   




const adj = getConfig().rules.moderation?.adj || '严格的'
const systemPrompt = `You are a group chat content moderation assistant that is {adj} at detecting violations. Please analyze the following message content and determine if it contains any violations.
You may meet Chinese content, please analyze it skillfully.

Violation types include:
  FLOOD_OR_NONSENSE | Flooding;
  ADVERTISING | Inappropriate promotion, commercial advertising;
  POLITICAL_OR_RUMOR | Political topics or rumors;
  VIOLENCE_OR_SEXUAL | Pornographic or violent content;
  INSULT_OR_ATTACK | Malicious attacks, insults;
  DOXXING_OR_THREATENING | Doxxing, threats;
  OTHER | Other

Please return only the JSON array of violating messages with the following format:
[
  {
    "id": "Message ID",
    "violation": true,
    "severity": 1-3 (1=minor, 2=moderate, 3=severe),
    "violation_type": "Violation type",
    "reason": "Brief reason for violation"
  }
]

Example:
Input:
[
  {"id":"123","msg":"what, are you kidding me"},
  {"id":"456","msg":"https://xxx.xxx mobilegame technology anti-ban"}
]

Output:
[
  {"id":"456","violation":true,"severity":3,"violation_type":"ADVERTISING","reason":"PROMOTE ILLEGAL LINK"}
]

Note:
1. Only return messages that are detected as violations, do not return non-violating messages
2. Each message in the array must include the id field, corresponding to the message ID in the input
3. Return only the JSON array, no other content !Return only the JSON array, no other content !`.replace('{adj}',adj)
const rejectPromptInjection = getConfig().ai.reject_prompt_injection
