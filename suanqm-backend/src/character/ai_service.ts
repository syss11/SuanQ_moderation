import OpenAI from 'openai';
import { Simplified_Message } from '../server/utils/suanq_types.js';
import { getConfig } from '../config/index.js';
import { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { logger } from '../logger.js';

interface AIProvider {
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  enable: boolean;
}

type AIUseCase = 'chat' | 'moderation';

function getEnabledProviders(useCase: AIUseCase = 'chat'): AIProvider[] | undefined {
  if (!getConfig().ai?.enable || !getConfig().ai?.providers) {
    return [];
  }

  const allProviders = getConfig().ai?.providers || [];
  
  let providerNames: string[];
  
  switch (useCase) {
    case 'chat':
      providerNames = getConfig().ai?.chat_use_provider || [];
      break;
    case 'moderation':
      providerNames = getConfig().ai?.moderation_use_provider || [];
      break;
    default:
      providerNames = [];
  }
  
  if (providerNames.length === 0) {
    return allProviders.filter(p => p.enable);
  }
  
  return allProviders.filter(p => p.enable && providerNames.includes(p.name));
}

function createOpenAIClient(provider: AIProvider): OpenAI {
  return new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL
  });
}

async function callAIWithRetry(
  messages: ChatCompletionMessageParam[], 
  maxTokens: number = 64, 
  temperature: number = 0.7,
  useCase: AIUseCase = 'chat'
): Promise<string> {
  const providers = getEnabledProviders(useCase);
  if (!providers) {
    throw new Error('没有可用的AI provider配置');
  }
  if (providers.length === 0) {
    throw new Error('没有可用的AI provider配置');
  }

  if (getConfig().ai?.reject_prompt_injection) {
    messages.push({
      role: 'system',
      content: getConfig().ai.reject_prompt_injection,
    });
  }

  // for (const msg of messages) {
  //   logger.log(msg);
  // }

  const errors: Array<{ provider: string; error: any }> = [];

  for (const provider of providers) {
    try {
      logger.log(`尝试使用 provider: ${provider.name} (${useCase}), 模型: ${provider.model}`);
      
      const openai = createOpenAIClient(provider);
      const response = await openai.chat.completions.create({
        model: provider.model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
      });

      const content = response.choices[0].message.content || '';
      logger.log(`Provider ${provider.name} 调用成功`);
      return content;
    } catch (error) {
      logger.error(`Provider ${provider.name} 调用失败:`, error);
      errors.push({ provider: provider.name, error });
      continue;
    }
  }

  throw new Error(`所有AI provider调用失败: ${errors.map(e => `${e.provider}: ${e.error.message}`).join('; ')}`);
}

function clean_message_for_ai(messages: Simplified_Message[keyof Simplified_Message][],max_length:number = 200): string {
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
                }
                break;
            case 'reply':
                textParts.push('[回复]');
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
                textParts.push('[转发]');
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

export { callAIWithRetry, clean_message_for_ai, getEnabledProviders };
