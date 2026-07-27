import { Simplified_GroupMessage, Simplified_Messages } from "../server/utils/suanq_types.js";
import { ModerationConfig } from "../config/config.js";
import { getConfig } from "../config/index.js";
import { ai_moderate, message_to_aitext,AIresult} from "../character/ai_moderate.js";
import { callAIWithRetry } from "../character/ai_service.js";
import { ViolationType, PenaltyType } from "../db/entities/Violation.js";
import VioPunish from "./vio_punish.js";
import actionManager from "./actions.js";
import { remind_violation } from "../character/behavior.js";
import { logger } from "../logger.js";

class ModerationDetector {
    private recorded_messages: Record<number, Simplified_GroupMessage[]> = {};
    private activated_timers: Record<number, NodeJS.Timeout> = {};
    private pool_size: number;
    private max_await_time: number;

    constructor(mconf: ModerationConfig){
        this.pool_size = mconf.pool_size;
        this.max_await_time = mconf.max_await_time;
    }

    reset_timer(group_id: number){
        if (this.activated_timers[group_id]) {
            clearTimeout(this.activated_timers[group_id]);
        }
    }

    process(message: Simplified_GroupMessage){
        this.reset_timer(message.group_id);
        if (!this.recorded_messages[message.group_id]) {
            this.recorded_messages[message.group_id] = [];
        }
        const pool = this.recorded_messages[message.group_id];
        pool.push(message);
        if (pool.length >= this.pool_size) {
            this.start_moderation(message.group_id,pool.slice());
        }else{
            this.activated_timers[message.group_id] = setTimeout(() => {
                this.start_moderation(message.group_id,pool.slice());
            }, this.max_await_time * 1000);
        }
    }

    async start_moderation(group_id: number,pool: Simplified_GroupMessage[]){
        
        if (!pool || pool.length === 0) {
            return;
        }
        
        this.recorded_messages[group_id] = [];
        
        logger.log(`[Moderation] 开始审核群 ${group_id} 的 ${pool.length} 条消息`);
        
        const messages = pool.map(msg => ({
            id: String(msg.message_id),
            text: message_to_aitext(msg.message)
        }));
        
        try {
            const results = await ai_moderate(messages, 64 * pool.length);
            
            const violationsByUser = new Map<number, { message: Simplified_GroupMessage; result: AIresult }>();
            
            for (const result of results) {
                const message = pool.find(m => String(m.message_id) === result.id);
                
                if (result.violation && message) {
                    const existing = violationsByUser.get(message.user_id);
                    
                    if (!existing || result.severity > existing.result.severity) {
                        violationsByUser.set(message.user_id, { message, result });
                    }
                }
            }
            
            logger.log(`[Moderation] 检测到 ${violationsByUser.size} 个违规用户`);
            
            for (const [userId, { message, result }] of violationsByUser) {
                logger.log(`[Moderation] 处理违规: 用户 ${userId}, 严重程度 ${result.severity}, 原因: ${result.reason}`);
                await this.handleViolation(message, result);
            }
        } catch (error) {
            logger.error('[Moderation] AI 审核失败:', error);
        }
        
    }

    private async handleViolation(message: Simplified_GroupMessage, result: { id: string; violation: boolean; severity: number; violation_type: ViolationType; reason: string }) {
        const mconf = getConfig().rules?.moderation;
        if (!mconf || !mconf.penalties) {
            return;
        }
        
        const penaltyConfig = mconf.penalties.find(p => p.severity === result.severity);
        if (!penaltyConfig) {
            logger.warn(`[Moderation] 未找到严重程度 ${result.severity} 的惩罚配置`);
            return;
        }
        
        actionManager.add_action(
            new VioPunish({
                group_id: message.group_id,
                userid: message.user_id,
                penalty_type: penaltyConfig.penalty.penalty_type,
                penalty_time: penaltyConfig.penalty.penalty_time || 0,
                violation_type: result.violation_type,
                severity: penaltyConfig.penalty.severity || result.severity,
                credit_deduction: penaltyConfig.penalty.credit_deduction || 0,
                callback: async (enable_ai,extra_prompt) => {
                    if (enable_ai) {
                        remind_violation(message,result,extra_prompt);
                    }
                }
            })
        );
    }
}


const mconf = getConfig().rules?.moderation as ModerationConfig;
const detector = new ModerationDetector(mconf);

export async function handle_moderation(
    message: Simplified_Messages
){
    if (message.message_type === "group") {
        
        detector.process(message);
    }
}
