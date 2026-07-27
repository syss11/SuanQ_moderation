import { Simplified_Messages } from '../server/utils/suanq_types.js';
import { quick_reply } from './utils.js';
import napcat from '../napcat/index.js';
import { logger } from '../logger.js';

/**
 * 验证检查器类型 - 返回 true 表示已处理，false 表示未处理
 */
export type VerificationChecker = (message: Simplified_Messages) => Promise<boolean>;

/**
 * 注册的验证检查器列表
 */
const verificationCheckers: VerificationChecker[] = [];

/**
 * 注册验证检查器
 */
export function registerVerificationChecker(checker: VerificationChecker): void {
  verificationCheckers.push(checker);
  logger.log('验证工具: 注册验证检查器');
}

/**
 * 注销验证检查器
 */
export function unregisterVerificationChecker(checker: VerificationChecker): void {
  const index = verificationCheckers.indexOf(checker);
  if (index > -1) {
    verificationCheckers.splice(index, 1);
    logger.log('验证工具: 注销验证检查器');
  }
}

/**
 * 运行所有注册的验证检查器
 * @returns true 表示有检查器处理了验证
 */
export async function runVerificationCheckers(message: Simplified_Messages): Promise<boolean> {
  for (const checker of verificationCheckers) {
    const handled = await checker(message);
    if (handled) {
      return true;
    }
  }
  return false;
}

/**
 * 验证失败时的回调接口
 */
export interface VerificationFailureHandler {
  /**
   * 重新显示验证题目
   * @param message 用户消息
   * @param retryTimes 已重试次数
   * @param remainingAttempts 剩余尝试次数
   */
  reshowChallenge(message: Simplified_Messages, retryTimes: number, remainingAttempts: number): Promise<void>;
  
  /**
   * 验证完全失败（超过重试次数）
   * @param message 用户消息
   */
  onVerificationFailed(message: Simplified_Messages): Promise<void>;
}

/**
 * 简单加法验证的处理器
 */
export class SimpleAdditionHandler implements VerificationFailureHandler {
  public question: string; // 公开，允许外部设置
  
  constructor(private num1: number, private num2: number) {
    this.question = `${num1} + ${num2} = ?`;
  }
  
  async reshowChallenge(message: Simplified_Messages, retryTimes: number, remainingAttempts: number): Promise<void> {
    await quick_reply(message, `验证错误，你还有 ${remainingAttempts} 次机会\n问题：${this.question}`);
  }
  
  async onVerificationFailed(message: Simplified_Messages): Promise<void> {
    await quick_reply(message, `验证失败，你已被移出群聊`);
  }
}

/**
 * 处理验证失败的通用函数
 */
export async function handleVerificationFailure(
  message: Simplified_Messages,
  retryTimes: number,
  maxRetries: number,
  handler: VerificationFailureHandler
): Promise<void> {
  // 验证逻辑只在群聊中进行
  if (message.message_type !== 'group') {
    return;
  }
  
  try {
    await napcat.delete_msg({
      message_id: message.message_id
    });
    
    const remainingAttempts = maxRetries - retryTimes;
    if (remainingAttempts > 0) {
      await handler.reshowChallenge(message, retryTimes, remainingAttempts);
    }
  } catch (error) {
    logger.error(`撤回消息失败:`, error);
  }

  if (retryTimes >= maxRetries) {
    try {
      await napcat.set_group_kick({
        group_id: message.group_id,
        user_id: message.user_id,
      });
      await handler.onVerificationFailed(message);
    } catch (error) {
      logger.error(`踢出用户失败:`, error);
    }
  }
}
