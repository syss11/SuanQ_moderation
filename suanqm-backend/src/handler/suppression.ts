import { Simplified_Messages } from "../server/utils/suanq_types.js";
import { suppressionService } from "../db/services/SuppressionService.js";
import { PenaltyType, ViolationType } from "../db/entities/Violation.js";
import VioPunish from "./vio_punish.js";
import actionManager from "./actions.js";
import { send_message_to_chat } from "../character/behavior.js";
import { clean_message_for_ai } from "../character/ai_service.js";
import { logger } from "../logger.js";
import { getConfig } from "../config/index.js";

function getLongMessageThreshold(): number {
  return getConfig()?.helper?.suppression?.long_message_threshold ?? 500;
}

function getNormalMessageCost(): number {
  return getConfig()?.helper?.suppression?.normal_message_cost ?? 8;
}

function getLongMessageCost(): number {
  return getConfig()?.helper?.suppression?.long_message_cost ?? 18;
}

function getMuteSecondsPerNegativeEnergy(): number {
  return getConfig()?.helper?.suppression?.mute_seconds_per_negative_energy ?? 10;
}

/**
 * 判断是否为长消息（参考 flood.ts L76/L92）：
 *  - 用 clean_message_for_ai 把消息链拼接成纯文本（与刷屏判定口径一致）
 *  - length > LONG_MESSAGE_THRESHOLD(500) 即判定为长消息
 */
export function isLongMessage(message: Simplified_Messages): boolean {
    const len = clean_message_for_ai(message.message, 10000).length;
    return len > getLongMessageThreshold();
}

/**
 * 参考 flood.ts L76/L92 计算发言扣费
 *  - 长消息：扣 18
 *  - 普通消息：扣 8
 */
export function calcMessageCost(message: Simplified_Messages): number {
    return isLongMessage(message) ? getLongMessageCost() : getNormalMessageCost();
}

/**
 * 格式化秒数为人类可读文本
 */
function formatDuration(sec: number): string {
    if (sec < 60) return `${sec}秒`;
    if (sec < 3600) return `${Math.floor(sec / 60)}分${sec % 60}秒`;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}时${m}分`;
}

/**
 * 处理压制消息，接入到主流程 tasks 中（与刷屏/审核并行）：
 * 1. 先判断 (user_id, group_id) 是否被压制（status=true 且未过期）
 * 2. 若被压制：按消息长度扣费 8 / 18（允许透支到负数，负值会累计保留）
 * 3. 扣后精力为负 → 禁言时长 = |remainingEnergy| * 10 秒，actionManager.add_action(VioPunish)
 *    callback 中提醒用户精力不足被禁言多久
 * 4. 不再每次提示 energy（仅在被禁言时由 callback 通知）
 */
export async function handleSuppression(message: Simplified_Messages): Promise<void> {
    try {
        if (message.message_type !== 'group') return;

        const suppressed = await suppressionService.isSuppressed(
            message.user_id,
            message.group_id,
        );
        if (!suppressed) return;

        const cost = calcMessageCost(message);
        const result = await suppressionService.consumeEnergy(
            message.user_id,
            message.group_id,
            cost,
        );

        if (!result.success || result.remainingEnergy === null) return;
        if (result.remainingEnergy >= 0) return;

        // 负值直接累计，禁言秒数 = 当前负精力绝对值 * 配置系数
        const muteSeconds = Math.floor(
            Math.abs(result.remainingEnergy) * getMuteSecondsPerNegativeEnergy()
        );
        const muteText = formatDuration(muteSeconds);

        actionManager.add_action(
            new VioPunish({
                group_id: message.group_id,
                userid: message.user_id,
                penalty_type: PenaltyType.MUTE,
                penalty_time: muteSeconds,
                violation_type: ViolationType.OTHER,
                severity: 0,
                credit_deduction: 0,
                skip_adapt_to_credit: true,
                callback: async () => {
                    try {
                        await send_message_to_chat(
                            message,
                            `精力不足(${Math.floor(result.remainingEnergy!)})，🚫${muteText}`
                        );
                    } catch (err) {
                        logger.error('[Suppression] 禁言提醒失败:', err);
                    }
                },
            })
        );

        logger.log(
            `[Suppression] 用户 ${message.user_id} 在群 ${message.group_id} ` +
            `精力 ${result.remainingEnergy.toFixed(2)}，禁言 ${muteSeconds}s`
        );
    } catch (error) {
        logger.error('处理压制消息失败:', error);
    }
}
