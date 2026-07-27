import { PenaltyType, ViolationType } from "../db/entities/Violation.js";
import { violationService } from "../db/services/ViolationService.js";
import { userService } from "../db/services/UserService.js";
import { getConfig } from "../config/index.js";
import napcat from '../napcat/index.js'
import { logger } from "../logger.js";



export type VioPunishParams = {
    group_id?: number;
    userid: number;
    penalty_type: PenaltyType;
    penalty_time: number;
    violation_type: ViolationType;
    severity?: number;
    credit_deduction?: number;
    callback?: (enable_ai?: boolean,extra_prompt?: string) => Promise<void> | void;
}

export default class VioPunish{
    public create_time: number;
    public group_id?: number;
    public userid: number;
    public penalty_type: PenaltyType;
    public penalty_time: number;
    public violation_type: ViolationType;
    public severity?: number;
    public credit_deduction?: number;
    public callback?: (enable_ai?: boolean,extra_prompt?: string) => Promise<void> | void;

    constructor(params: VioPunishParams) {
        this.create_time = Math.floor(Date.now() / 1000);
        this.group_id = params.group_id;
        this.userid = params.userid;
        this.penalty_type = params.penalty_type as PenaltyType;
        this.penalty_time = params.penalty_time;
        this.violation_type = params.violation_type;
        this.severity = params.severity;
        this.credit_deduction = params.credit_deduction;
        this.callback = params.callback;
    }

    async execute(history_actions: VioPunish[],already_mute: {s: number}){
        
        const currentTime = Math.floor(Date.now() / 1000);
        
        if (this.penalty_type.toUpperCase() === 'MUTE') {
            if (history_actions.some(action => 
                action.userid === this.userid &&
                action.penalty_type.toUpperCase() === 'MUTE' &&
                action.create_time >= currentTime - 5 &&
                action.penalty_time <= this.penalty_time
            )) {
                logger.log(`用户${this.userid}在5秒内已有禁言记录，跳过本次惩罚`);
                return;
            }
            
        }

        let enable_ai=true;
        let extra_prompt="";

        if (history_actions.some(action => 
                action.callback && action.userid === this.userid)) {
            logger.log(`用户${this.userid}在惩罚记录中已有回调函数，跳过本次ai`);
            enable_ai=false;
        }

        const userCredit = await userService.getUserGroupCredit(this.group_id || 0, this.userid);
        if (userCredit !== null) {
            this.adapt_to_credit(userCredit);
        }

        const creditChange = -(this.credit_deduction || 0);

        const violation = await violationService.createViolation({
            user_id: this.userid,
            time: currentTime,
            violation_type: this.violation_type,
            severity: this.severity,
            credit_change: creditChange,
            penalty_type: this.penalty_type,
            penalty_time: this.penalty_time,
            description: `执行${this.penalty_type}惩罚，违规类型${this.violation_type}`
        });

        if (violation) {
            logger.log(`违规记录已创建: ID=${violation.id}, 用户=${this.userid}, 类型=${this.violation_type}`);
        } else {
            logger.error(`创建违规记录失败: 用户=${this.userid}`);
        }



        if (this.credit_deduction && this.credit_deduction > 0) {
            const newCredit = await userService.decreaseUserGroupCredit(this.group_id || 0, this.userid, this.credit_deduction);
            if (newCredit !== null) {
                logger.log(`用户${this.userid}积分已扣除${this.credit_deduction}，当前积分: ${newCredit}`);
                extra_prompt += `用户已被你扣除${this.credit_deduction}信誉分，当前还有: ${newCredit}\n`;
                if (newCredit < getConfig().user.credit.kick_threshold) {
                    logger.log(`用户${this.userid}积分已低于斩杀线`);
                    if (!this.group_id) {
                        logger.error(`用户${this.userid}在非群聊环境中，无法被踢出`);
                        return;
                    }
                    try {
                        await napcat.set_group_kick({
                            group_id: this.group_id,
                            user_id: this.userid,
                            reject_add_request: false
                        })
                        extra_prompt += `用户已被你踢出群聊`;
                    } catch (error) {
                        logger.error(`踢出用户${this.userid}失败: ${error}`);
                    }
                }
            } else {
                logger.error(`扣除用户${this.userid}积分失败`);
            }
        }

        logger.log(`执行${this.penalty_type}惩罚，用户${this.userid}，时间${this.penalty_time}，违规类型${this.violation_type}，严重程度${this.severity}，积分扣除${this.credit_deduction}`);
        

        if (this.penalty_type.toUpperCase() == PenaltyType.MUTE.toUpperCase()) {
            
            if (this.group_id) {
                already_mute.s += this.penalty_time;
                try {
                    await napcat.set_group_ban({
                        group_id: this.group_id,
                        user_id: this.userid,
                        duration: already_mute.s
                    });
                    logger.log(`用户${this.userid}已被禁言${this.penalty_time}秒`);
                    extra_prompt += `用户已被你禁言${this.penalty_time}秒`;
                } catch (error) {
                    logger.error(`禁言用户${this.userid}失败: ${error}`);
                }
            } 
        } 
        
        if (this.callback) {
                try {
                    await this.callback(enable_ai,extra_prompt);
                } catch (error) {
                    logger.error(`执行回调函数失败: ${error}`);
                }
            }
        
    }

    adapt_to_credit(credit: number){
        const tiers = getConfig().user?.credit?.tiers;
        if (!tiers || tiers.length === 0) {
            return;
        }

        const tier = tiers.find(t => credit >= t.min_credit && credit <= t.max_credit);
        if (!tier) {
            return;
        }

        if (this.penalty_time > 0) {
            this.penalty_time = Math.floor(this.penalty_time * tier.mute_multiplier);
            logger.log(`penalty_time 调整: ${Math.floor(this.penalty_time / tier.mute_multiplier)} -> ${this.penalty_time}`);
        }

        if (this.credit_deduction && this.credit_deduction > 0) {
            this.credit_deduction = Math.floor(this.credit_deduction * tier.dc_multiplier);
            logger.log(`credit_deduction 调整: ${Math.floor(this.credit_deduction / tier.dc_multiplier)} -> ${this.credit_deduction}`);
        }
    }
    
}