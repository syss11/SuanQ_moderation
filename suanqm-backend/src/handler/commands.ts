import { Simplified_GroupMessage, Simplified_Messages } from "../server/utils/suanq_types";
import { userService } from "../db/services/UserService.js";
import { messageService } from "../db/services/MessageServices.js";
import { humanVerificationService } from "../db/services/HumanVerificationService.js";
import userInteractionService from "../db/services/UserInteractionService.js";
import napcat from "../napcat/index.js";
import { quick_reply, readFileContent } from "./utils.js";
import { handleVerificationFailure, SimpleAdditionHandler } from './verification-utils.js';
import { self_id } from "../napcat/main.js";
import { getConfig, setConfigByPath } from "../config/index.js";
import { generateDocumentation } from "../config/index.js";
import { addImageBlacklist, removeImageBlacklist } from "./image_blacklist.js";
import { AppDataSource } from "../db/database.js";
import { Image } from "../db/entities/Image.js";
import { logger } from "../logger.js";
import { ai_moderate, message_to_aitext } from "../character/ai_moderate.js";
import { sensitiveFilter } from "../services/filter.js";
import coAdminHandler from "../services/coAdmin.js";
import coAdminService from "../db/services/CoAdminService.js";
import commandLogService from "../db/services/CommandLogService.js";
import { shutdown, isShuttingDown } from "../index.js";
import { callbackManager } from "./callback.js";

export type auth_grade = 'member'|'admin'|'owner';

export type sqparam={
    name: string,
    type: 'string'|'number'|'boolean',
    default?: string|number|boolean,
}

export class SuanqCommand{
    public command: string;
    public description: string;
    public params: sqparam[];
    public last_call_time: number;
    public cd: number;
    public auth?: auth_grade;
    public supportCoAdmin: boolean;
    public isPlugin: boolean;
    private callback: (params: Record<string, string|number|boolean>, message: Simplified_Messages) => Promise<void>;

    constructor(SuanqCommandParams: {
        command: string,
        description?: string,
        params: sqparam[],
        cd: number,
        auth?: auth_grade,
        supportCoAdmin?: boolean,
        isPlugin?: boolean,
        callback: (params: Record<string, string|number|boolean>, message: Simplified_Messages) => Promise<void>
    }){
        this.command = SuanqCommandParams.command;
        this.description = SuanqCommandParams.description || '';
        this.params = SuanqCommandParams.params;
        this.cd = SuanqCommandParams.cd;
        this.auth = SuanqCommandParams.auth;
        this.supportCoAdmin = SuanqCommandParams.supportCoAdmin || false;
        this.isPlugin = SuanqCommandParams.isPlugin || false;
        this.callback = SuanqCommandParams.callback;
        this.last_call_time = 0;
    }

    private async checkAuth(message: Simplified_Messages, targetUserId?: number, parsedParams?: Record<string, string|number|boolean>): Promise<{ allowed: boolean; isCoAdmin?: boolean }> {
        if (!this.auth) {
            return { allowed: true };
        }

        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用');
            return { allowed: false };
        }

        const userRole = await messageService.getUserGroupRole(message.group_id, message.user_id);
        
        if (!userRole) {
            await quick_reply(message, '未找到你的群组信息');
            return { allowed: false };
        }

        const roleHierarchy: Record<auth_grade, number> = {
            'owner': 3,
            'admin': 2,
            'member': 1
        };

        const requiredLevel = roleHierarchy[this.auth];
        const userLevel = roleHierarchy[userRole as auth_grade] || 1;
        let isCoAdmin: boolean = false;
        if (userLevel < requiredLevel) {
            if (this.supportCoAdmin) {
                const coAdminResult = await coAdminHandler.canExecute(message.user_id, message.group_id, this.command as any, parsedParams);
                if (!coAdminResult.allowed) {
                    await quick_reply(message, coAdminResult.message || '权限不足');
                    return { allowed: false };
                }
                isCoAdmin = true;

            } else {
                await quick_reply(message, `权限不足，需要 ${this.auth} 权限`);
                return { allowed: false };
            }
        }

        if (targetUserId) {
            const targetRole = await messageService.getUserGroupRole(message.group_id, targetUserId);
            
            if (!targetRole) {
                await quick_reply(message, `目标用户 ${targetUserId} 不在本群中`);
                return { allowed: false };
            }

            const targetLevel = roleHierarchy[targetRole as auth_grade] || 1;
            
            if (userLevel >= requiredLevel && !isCoAdmin) {
                if (targetLevel >= userLevel) {
                    await quick_reply(message, `权限不足，无法对 ${targetRole} 角色的用户进行操作`);
                    return { allowed: false };
                }
            } else {
                if (targetLevel > 1) {
                    await quick_reply(message, `协管无法对 ${targetRole} 角色的用户进行操作`);
                    return { allowed: false };
                }
                const isTargetCoAdmin = await coAdminService.isCoAdmin(targetUserId, message.group_id);
                if (isTargetCoAdmin) {
                    await quick_reply(message, `协管无法对其他协管进行操作`);
                    return { allowed: false};
                }
            }
            
        }

        return { allowed: true, isCoAdmin: isCoAdmin };
    }

    async execute(params: string[], message: Simplified_Messages){
        
        const requiredParams = this.params.filter(param => param.default === undefined);
        if (params.length < requiredParams.length) {
            const missingParams = requiredParams.map(p => p.name).join('、');
            await quick_reply(message, `缺少必要参数: ${missingParams}`);
            return false;
        }
        const parsed_params: Record<string, string|number|boolean> = {};
        for (let i = 0; i < this.params.length; i++) {
            const paramDef = this.params[i];
            const paramValue = params[i];
            
            if (paramValue !== undefined) {
                if (paramDef.type === 'string') {
                    parsed_params[paramDef.name] = paramValue;
                } else if (paramDef.type === 'number') {
                    const numValue = Number(paramValue);
                    if (isNaN(numValue)) {
                        await quick_reply(message, `参数 ${paramDef.name} 必须是数字`);
                        return false;
                    }
                    parsed_params[paramDef.name] = numValue;
                } else if (paramDef.type === 'boolean') {
                    const boolValue = paramValue.toLowerCase();
                    if (boolValue !== 'true' && boolValue !== 'false') {
                        await quick_reply(message, `参数 ${paramDef.name} 必须是 true 或 false`);
                        return false;
                    }
                    parsed_params[paramDef.name] = boolValue === 'true';
                }
            } else if (paramDef.default !== undefined) {
                parsed_params[paramDef.name] = paramDef.default;
            }
        }

        const authResult = await this.checkAuth(message, parsed_params.userId as number, parsed_params);
        if (!authResult.allowed) {
            return false;
        }

        let rulingCost: number | null = null;
        if (authResult.isCoAdmin && this.supportCoAdmin) {
            const result = await coAdminHandler.canExecute(message.user_id, (message as any).group_id, this.command as any, parsed_params);
            rulingCost = result.cost ?? null;
        }

        try {
            await this.callback(parsed_params, message);
            
            if (authResult.isCoAdmin && this.supportCoAdmin) {
                await coAdminHandler.handleCommand(message.user_id, (message as any).group_id, this.command as any, parsed_params);
            }

            const log = await commandLogService.log({
                user_id: message.user_id,
                group_id: (message as any).group_id ?? null,
                command: this.command,
                params: parsed_params,
                is_co_admin: authResult.isCoAdmin ?? false,
                ruling_cost: rulingCost,
                target_user_id: parsed_params.userId as number ?? null,
                auth_level: this.auth ?? null,
                success: true,
            });

            if (authResult.isCoAdmin && this.supportCoAdmin) {
                await quick_reply(message, '请输入操作理由：');
                callbackManager.register_callback( (message as any).group_id, message.user_id,async (msg)=>{
                    await commandLogService.addReason(log.id, msg.raw_message);
                    await napcat.set_msg_emoji_like({
                        message_id: message.message_id,
                        emoji_id: '124',
                        set: true,
                    })
                }, true);
            }


            return true;
        } catch (error) {
            await commandLogService.log({
                user_id: message.user_id,
                group_id: (message as any).group_id ?? null,
                command: this.command,
                params: parsed_params,
                is_co_admin: authResult.isCoAdmin ?? false,
                ruling_cost: rulingCost,
                target_user_id: parsed_params.userId as number ?? null,
                auth_level: this.auth ?? null,
                success: false,
                error_message: error instanceof Error ? error.message : String(error),
            });
        }
    }
}

const commands: SuanqCommand[] = [
    new SuanqCommand({
        command: 'test',
        description: '测试命令',
        params: [],
        cd: 1,
        callback: async (params, message) => {
            await quick_reply(message, '测试成功');
        }
    }),
    new SuanqCommand({
        command: 'setconfig',
        description: '修改配置项，支持set/add/remove操作',
        params: [
            { name: 'path', type: 'string' },
            { name: 'value', type: 'string' },
            { name: 'action', type: 'string', default: 'set' }
        ],
        cd: 1,
        auth: 'admin',
        callback: async (params, message) => {
            const deployer = getConfig().deployer;
            if (deployer !== undefined && message.user_id !== deployer) {
                await quick_reply(message, '此命令仅限部署者使用', true);
                return;
            }

            const path = params.path as string;
            let value: string | number | boolean;
            const action = (params.action as string) || 'set';

            if (!['set', 'add', 'remove'].includes(action)) {
                await quick_reply(message, '操作类型必须是 set、add 或 remove', true);
                return;
            }

            if (params.value === 'true') {
                value = true;
            } else if (params.value === 'false') {
                value = false;
            } else if (!isNaN(Number(params.value))) {
                value = Number(params.value);
            } else {
                value = params.value as string;
            }

            const result = setConfigByPath(path, value, action as 'set' | 'add' | 'remove');
            await quick_reply(message, result.message);
        }
    }),
    new SuanqCommand({
        command: 'credit',
        description: '查询用户在本群的信誉分和互动次数',
        params: [],
        cd: 1,
        callback: async (params, message) => {
            if (message.message_type === 'group') {
                const credit = await userService.getUserGroupCredit(message.group_id, message.user_id);

                
                const remainingInteractions = await userInteractionService.getRemainingInteractions(message.user_id, message.group_id);
                const maxInteractions = getConfig().user?.credit?.max_daily_interactions || 3;
            
                let replyText = credit !== null 
                    ? `你在本群的信誉分：${credit}` 
                    : '未找到你在本群的信誉分记录';
                replyText += `\n剩余互动：${remainingInteractions}/${maxInteractions}`;
                await quick_reply(message, replyText);
            } else {
                await quick_reply(message, '此命令仅限群聊使用', true);
            }
        }
    }),
    // new SuanqCommand({
    //     command: 'credits',
    //     description: '查看群成员信誉分列表（从小到大，不满最大信誉分）',
    //     params: [],
    //     cd: 1,
    //     callback: async (params, message) => {
    //         if (message.message_type !== 'group') {
    //             await quick_reply(message, '此命令仅限群聊使用');
    //             return;
    //         }

    //         const members = await userService.getGroupCredits(message.group_id, getConfig().user.credit.max);
            
    //         if (members.length === 0) {
    //             await quick_reply(message, '本群暂无成员不满最大信誉分');
    //             return;
    //         }

    //         let replyText = '本群成员（不满）信誉分：\n\n';
            
    //         for (let i = 0; i < members.length; i++) {
    //             const member = members[i];
    //             replyText += `${i + 1}. ${member.nickname}: ${member.credit}\n`;
    //         }
            
    //         await quick_reply(message, replyText);
    //     }
    // }),
    new SuanqCommand({
        command: '签到',
        description: '每日签到，获得信誉分',
        params: [],
        cd: 1,
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }

            const result = await userInteractionService.performCheckin(message.user_id, message.group_id);

            if (result.success) {
                const currentCredit = await userService.getUserGroupCredit(message.group_id, message.user_id);
                if (currentCredit === null) {
                    await quick_reply(message, '未找到你在本群的信誉分记录', true);
                    return;
                }

                const tiers = getConfig().user?.credit?.tiers;
                let creditReward = 2;
                
                if (tiers && tiers.length > 0) {
                    const tier = tiers.find(t => currentCredit >= t.min_credit && currentCredit <= t.max_credit);
                    if (tier && tier.checkin_award !== undefined) {
                        creditReward = tier.checkin_award;
                    }
                }
                
                const newCredit = Math.min(getConfig().user.credit.max, currentCredit + creditReward);
                
                await userService.updateUserGroupCredit(message.group_id, message.user_id, newCredit);
                
                const isCoAdmin = await coAdminService.isCoAdmin(message.user_id, message.group_id);
                if (isCoAdmin) {
                    const coAdmin = await coAdminService.getByUserId(message.user_id, message.group_id);
                    if (coAdmin) {
                        let newRuling = Math.min(coAdmin.max_ruling+coAdmin.ruling , coAdmin.max_ruling);
                        if (coAdmin.ruling >= coAdmin.max_ruling) {
                            newRuling = coAdmin.ruling;
                        }
                        await coAdminService.update(message.user_id, message.group_id, { ruling: newRuling });
                        
                        await quick_reply(message, `签到成功(+${creditReward})，当前信誉分: ${newCredit}\n裁决点(${newRuling})`);
                    }
                }else{
                    await quick_reply(message, `签到成功(+${creditReward})，当前信誉分: ${newCredit}`);
                }
            } else {
                await quick_reply(message, `${result.message}`, true);
            }
        }
    }),
    new SuanqCommand({
        command: 'ban',
        description: '禁言用户',
        params: [
            { name: 'userId', type: 'number' },
            { name: 'duration', type: 'number', default: 300 }
        ],
        cd: 2,
        auth: 'admin',
        supportCoAdmin: true,
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }
            if (params.duration as number < 0) {
                await quick_reply(message, '禁言时长不能小于0秒', true);
                return;
            }
            try {
                await napcat.set_group_ban({
                    group_id: message.group_id,
                    user_id: params.userId as number,
                    duration: params.duration as number,
                })
                await quick_reply(message, `禁言成功，时长 ${params.duration}秒`);
            
            } catch (error) {
                await quick_reply(message, `禁言用户失败: ${error}`, true);
            }
        }
    }),
    new SuanqCommand({
        command: 'kick',
        description: '踢出用户',
        params: [
            { name: 'userId', type: 'number' }
        ],
        cd: 10,
        auth: 'admin',
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }
            
            await quick_reply(message, `踢出成功，用户ID: ${params.userId}`);
            try {
                await napcat.set_group_kick({
                    group_id: message.group_id,
                    user_id: params.userId as number,
                })
            } catch (error) {
                await quick_reply(message, `踢出用户失败: ${error}`, true);
            }
        }
    }),
    new SuanqCommand({
        command:'recall',
        description: '撤回消息',
        params: [
            { name: 'messageId', type: 'number' }
        ],
        cd: 1,
        auth: 'admin',
        supportCoAdmin: true,
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }
            try {
                await napcat.delete_msg({
                    message_id: params.messageId as number,
                })
                if (getConfig().helper?.recall_preventer.enabled) {
                    await forwardRecallMessage(message.group_id, message.message_id);
                }
                
            } catch (error) {
                await quick_reply(message, `撤回失败: ${error}`, true);
            }
        }
    }),
    
    new SuanqCommand({
        command: 'setcredit',
        description: '设置用户在本群的信誉分',
        params: [
            { name: 'userId', type: 'number' },
            { name: 'credit', type: 'number' }
        ],
        cd: 2,
        auth: 'admin',
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }
            let toCredit = params.credit as number;
            if (toCredit < getConfig().user?.credit?.kick_threshold) {
                toCredit = getConfig().user?.credit?.kick_threshold;
            }else if (toCredit > getConfig().user?.credit?.max) {
                toCredit = getConfig().user?.credit?.max;
            }
            const success = await userService.updateUserGroupCredit(message.group_id, params.userId as number, toCredit);
            if (success) {
                await quick_reply(message, `已将用户 ${params.userId} 在本群的信誉分设置为 ${toCredit}`);
            } else {
                await quick_reply(message, `设置失败，用户 ${params.userId} 在本群不存在`, true);
            }
        }
    }),
    new SuanqCommand({
        command: 'setinter',
        description: '设置用户在本群的交互次数',
        params: [
            { name: 'userId', type: 'number' },
            { name: 'count', type: 'number' }
        ],
        cd: 2,
        auth: 'admin',
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }
            const count = params.count as number;
            if (count < 0 || count > 10) {
                await quick_reply(message, '交互次数必须在0-10之间', true);
                return;
            }
            await userInteractionService.resetInteractions(params.userId as number,message.group_id, count);
            await quick_reply(message, `已将用户 ${params.userId} 在本群的剩余互动次数设为 ${count}`);
        }
    }),
    new SuanqCommand({
        command: 'addban',
        description: '添加屏蔽词',
        params: [
            { name: 'word', type: 'string' },
            { name: 'severity', type: 'number', default: 1 }
        ],
        cd: 2,
        auth: 'admin',
        callback: async (params, message) => {
            const word = params.word as string;
            const severity = params.severity as number;
            if (!word || word.trim() === '') {
                await quick_reply(message, '屏蔽词不能为空', true);
                return;
            }
            const allowedSeverities = getConfig().rules.sensitive.penalties.map(p => p.severity);
            if (!allowedSeverities.includes(severity)) {
                await quick_reply(message, `严重程度必须是 ${allowedSeverities.join('、')} 之一`, true);
                return;
            }
            sensitiveFilter.add(word.trim(), severity);
            sensitiveFilter.save();
            await quick_reply(message, `已添加屏蔽词（严重程度：${severity}）`);
            logger.log(`[Commands] 用户 ${message.user_id} 添加屏蔽词: ${word.trim()}，严重程度：${severity}`);
        }
    }),
    new SuanqCommand({
        command: 'rmban',
        description: '移除屏蔽词',
        params: [
            { name: 'word', type: 'string' }
        ],
        cd: 2,
        auth: 'admin',
        callback: async (params, message) => {
            const word = params.word as string;
            if (!word || word.trim() === '') {
                await quick_reply(message, '屏蔽词不能为空', true);
                return;
            }
            sensitiveFilter.remove(word.trim());
            sensitiveFilter.save();
            await quick_reply(message, `已移除屏蔽词: ${word.trim()}`);
            logger.log(`[Commands] 用户 ${message.user_id} 移除屏蔽词: ${word.trim()}`);
        }
    }),
    new SuanqCommand({
        command:"help", 
        description: '显示可用命令',
        params:[],
        cd:1,
        callback:async (params, message) => {
            const coreCommands = allCommands.filter(c => !c.isPlugin);
            const pluginCommands = allCommands.filter(c => c.isPlugin);
            
            let helpText = '=== 核心命令 ===\n';
            helpText += coreCommands.map(c => `${c.command} - ${c.description}`).join('\n');
            
            if (pluginCommands.length > 0) {
                helpText += '\n\n=== 插件命令 ===\n';
                helpText += pluginCommands.map(c => `${c.command} - ${c.description}`).join('\n');
            }
            
            if (message.message_type !== 'group') {
                await quick_reply(message, helpText);
                return;
            }

            try{
                await napcat.send_group_forward_msg({
                    group_id: message.group_id,
                    message:[{
                        type: 'node',
                        data: {
                            user_id: String(self_id),
                            nickname: '命令帮助',
                            content: [
                                {
                                    type: 'text',
                                    data: {
                                        text: helpText
                                    }
                                }
                            ]
                        }
                    }]
                })
            } catch (error) {
                logger.error('发送命令帮助失败:', error);
                throw error;
            }
        }
    }),
    new SuanqCommand({
        command: 'configinfo',
        description: '查看配置项说明',
        params: [],
        cd: 18,
        auth: 'admin',
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }

            try {
                const configGuideContent = readFileContent('config/config_guide.json');
                if (!configGuideContent) {
                    await quick_reply(message, '获取配置说明失败', true);
                    return;
                }

                await napcat.send_group_forward_msg({
                    group_id: message.group_id,
                    message: [{
                        type: 'node',
                        data: {
                            user_id: String(self_id),
                            nickname: '配置说明',
                            content: [{
                                type: 'text',
                                data: {
                                    text: configGuideContent
                                }
                            }]
                        }
                    }]
                });
            } catch (error) {
                logger.error('发送配置说明失败:', error);
                await quick_reply(message, '获取配置说明失败', true);
            }
        }
    }),
    new SuanqCommand({
        command: 'doc',
        description: '查看群聊管理规则',
        params: [],
        cd: 30,
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }

            try {
                const doc = generateDocumentation();

                await napcat.send_group_forward_msg({
                    group_id: message.group_id,
                    message: [{
                        type: 'node',
                        data: {
                            user_id: String(self_id),
                            nickname: '群聊管理规则',
                            content: [{
                                type: 'text',
                                data: {
                                    text: doc
                                }
                            }]
                        }
                    }]
                });
            } catch (error) {
                logger.error('发送群聊管理规则失败:', error);
                await quick_reply(message, '获取规则文档失败', true);
            }
        }
    }),
    new SuanqCommand({
        command: 'verify',
        description: '对用户发起人机验证',
        params: [
            { name: 'userId', type: 'number' },
            { name: 'difficulty', type: 'string', default: 'medium' }
        ],
        cd: 2,
        auth: 'admin',
        supportCoAdmin: true,
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }

            const pendingVerification = await humanVerificationService.getPendingVerification(params.userId as number, message.group_id);
            if (pendingVerification) {
                await quick_reply(message, `用户 ${params.userId} 已有验证请求`, true);
                return;
            }

            const difficulty = params.difficulty as string;
            let num1Max: number;
            let num2Max: number;

            switch (difficulty) {
                case 'easy':
                    num1Max = 18;
                    num2Max = 9;
                    break;
                case 'hard':
                    num1Max = 100000;
                    num2Max = 67779;
                    break;
                case 'medium':
                default:
                    num1Max = 100;
                    num2Max = 40;
                    break;
            }

            const num1 = Math.floor(Math.random() * num1Max);
            const num2 = Math.floor(Math.random() * num2Max);
            const answer = num1 + num2;
            const key = `${Date.now()}-${params.userId}-${num1}-${num2}`;

            await humanVerificationService.createVerification({
                user_id: params.userId as number,
                group_id: message.group_id,
                key: key,
                expected_answer: answer.toString()
            });

            await napcat.send_group_msg({
                group_id: message.group_id,
                message: [
                {
                    type: 'at',
                    data: {
                        qq: params.userId as string
                    }
                },
                {
                    type: 'text',
                    data: {
                        text: ` 验证已开始，请回答：${num1} + ${num2} = ? \n 你有三次机会，期间不能发言，请直接给出答案！`
                    }
                }]
            });
        }
    }),
    new SuanqCommand({
        command: 'pass',
        description: '通过用户验证',
        params: [
            { name: 'userId', type: 'number' }
        ],
        cd: 2,
        auth: 'admin',
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }

            const userId = params.userId as number;
            
            const success = await humanVerificationService.updateVerificationByUser(userId, message.group_id, {
                status: 'passed',
                user_answer: 'exempted'
            });
            
            if (success) {
                await quick_reply(message, `已通过用户 ${userId} 的验证`);
                logger.log(`[Commands] 用户 ${message.user_id} 通过了用户 ${userId} 的验证`);
            } else {
                await quick_reply(message, `用户 ${userId} 没有待处理的验证请求`);
            }
        }
    }),
    new SuanqCommand({
        command: 'shutdown',
        description: '关闭机器人',
        params: [],
        cd: 0,
        callback: async (params, message) => {
            const deployer = getConfig().deployer;
            
            if (message.user_id !== deployer) {
                await quick_reply(message, '权限不足', true);
                return;
            }

            if (isShuttingDown) {
                await quick_reply(message, '机器人正在关闭中...');
                return;
            }
            
            await quick_reply(message, '正在关闭机器人...');
            shutdown();
        }
    }),
    new SuanqCommand({
        command: 'banimg',
        description: '禁用图片',
        params: [
            { name: 'md5', type: 'string' },
            { name: 'messageId', type: 'string', default: '' },
        ],
        cd: 1,
        auth: 'admin',
        supportCoAdmin: true,
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }
            logger.log('[Commands] 禁用图片:', params.md5, '消息ID:', params.messageId);
            
            const imageRepo = AppDataSource.getRepository(Image);
            const image = await imageRepo.findOne({ where: { md5: params.md5 as string } });
            
            if (!image || image.phash === null || image.phash === undefined) {
                await quick_reply(message, `图片不存在或pHash未计算`, true);
                return;
            }
            
            const success = await addImageBlacklist(BigInt(image.phash), '命令操作');
            
            if (success) {
                try{
                    if (params.messageId!='') {
                        await napcat.delete_msg({
                            message_id: Number(params.messageId)
                        });
                    }
                }catch(error){
                    logger.error('[Commands] 删除消息失败:', error);
                }
                await quick_reply(message, `已禁用图片 MD5=${String(params.md5)}`);
            } else {
                await quick_reply(message, `添加失败`, true);
            }
        }
    }),
    new SuanqCommand({
        command: 'unbanimg',
        description: '解禁图片',
        params: [
            { name: 'md5', type: 'string' }
        ],
        cd: 1,
        auth: 'admin',
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }
            
            const imageRepo = AppDataSource.getRepository(Image);
            const image = await imageRepo.findOne({ where: { md5: params.md5 as string } });
            
            if (!image || image.phash === null || image.phash === undefined) {
                await quick_reply(message, `图片不存在或pHash未计算`, true);
                return;
            }
            
            const success = await removeImageBlacklist(BigInt(image.phash));
            
            if (success) {
                await quick_reply(message, `已将图片 MD5=${params.md5}移出黑名单`);
            } else {
                await quick_reply(message, `移除失败，图片 MD5=${params.md5} 不存在`, true);
            }
        }
    }),
    new SuanqCommand({
        command: 'moderate',
        description: '对指定消息进行AI审核',
        params: [
            { name: 'messageId', type: 'number' }
        ],
        cd: 5,
        auth: 'admin',
        callback: async (params, message) => {
            if (message.message_type !== 'group') {
                await quick_reply(message, '此命令仅限群聊使用', true);
                return;
            }

            const messageId = params.messageId as number;
            const groupMessage = await messageService.getGroupMessageById(messageId);

            if (!groupMessage) {
                await quick_reply(message, `未找到消息`, true);
                return;
            }

            const messageText = message_to_aitext(groupMessage.message);
            
            try {
                await quick_reply(message, `尝试中...`);

                const results = await ai_moderate([{
                    id: String(messageId),
                    text: messageText
                }], 64);

                const result = results[0];

                let replyText = `消息审核结果:\n`;
                replyText += `消息ID: ${messageId}\n`;
                replyText += `内容: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}\n`;
                replyText += `违规: ${result.violation ? '是' : '否'}\n`;
                
                if (result.violation) {
                    replyText += `严重程度: ${result.severity}\n`;
                    replyText += `违规类型: ${result.violation_type}\n`;
                    replyText += `原因: ${result.reason}\n`;
                }

                await quick_forward(message, 'AI审核', replyText);
            } catch (error) {
                logger.error('[Commands] AI审核失败:', error);
                await quick_reply(message, `AI审核失败: ${error}`, true);
            }
        }
    }),
];

import coadminCommandConfigs from "./coadmin_commands.js";
import { forwardRecallMessage } from "../services/recallhelper.js";

const coadminCommands = coadminCommandConfigs.map(config => new SuanqCommand(config));
let allCommands: SuanqCommand[] = [...commands, ...coadminCommands];

export function registerCommand(command: SuanqCommand, isPlugin: boolean = false): void {
  const existingCommand = allCommands.find(cmd => cmd.command === command.command);
  if (existingCommand) {
    logger.warn(`命令 ${command.command} 已存在，将被覆盖`);
    allCommands = allCommands.filter(cmd => cmd.command !== command.command);
  }
  
  // 标记为插件命令
  if (isPlugin) {
    command.isPlugin = true;
  }
  
  allCommands.push(command);
  logger.log(`命令 ${command.command} 注册成功${isPlugin ? ' [插件]' : ''}`);
}

export function unregisterCommand(commandName: string): void {
  allCommands = allCommands.filter(cmd => cmd.command !== commandName);
  logger.log(`命令 ${commandName} 注销成功`);
}

export { allCommands };

async function quick_forward(
    message: Simplified_GroupMessage,
    nickname: string,
    text: string
): Promise<void> {
    try {
        await napcat.send_group_forward_msg({
            group_id: message.group_id,
            message: [{
                type: 'node',
                data: {
                    user_id: String(self_id),
                    nickname: nickname,
                    content: [{
                        type: 'text',
                        data: {
                            text: text
                        }
                    }]
                }
            }]
        });
    } catch (error) {
        logger.error('发送转发消息失败:', error);
        throw error;
    }
}

export function match_command(message:Simplified_Messages):boolean{
    let commandText = '';
    for (const msg of message.message) {
        if (msg.type === 'text') {
            const text = msg.data.text.trim();
            if (text) {
                const parts = text.split(' ').filter(s => s !== '');
                if (parts.length > 0) {
                    commandText = parts[0];
                    break;
                }
            }
        }
    }
    
    if (!commandText) {
        return false;
    }
    
    return allCommands.some(cmd => cmd.command === commandText);
}

async function getReplyImageMD5(replyId: string): Promise<string | null> {
    try {
        const imageRepo = AppDataSource.getRepository(Image);
        const image = await imageRepo.findOne({
            where: { message_id: Number(replyId) }
        });
        return image ? image.md5 : null;
    } catch (error) {
        logger.error('[Commands] 获取回复图片失败:', error);
        return null;
    }
}

export async function handle_commands(
    message: Simplified_Messages
){
    
    if (!match_command(message)) {
        return;
    }

    let source :string[]=[]
    let reply_id:string='';
    for (const msg of message.message) {
        if (msg.type === 'text') {
            source.push(...msg.data.text.trim().split(' ').filter(s=>s!==''));
        }else if (msg.type === 'at') {
            source.push(msg.data.qq);
        }else if (msg.type === 'reply') {
            reply_id = msg.data.id;
        }
    }
    
    const command = source[0];
    const params = source.slice(1);
    
    let imageMD5: string | null = null;
    
    const imageCommands = ['banimg', 'unbanimg'];
    
    if (reply_id && params.length === 0 && imageCommands.includes(command)) {
        imageMD5 = await getReplyImageMD5(reply_id);
        if (imageMD5) {
            params.push(imageMD5);
        }else{
            logger.log('[Commands] 回复消息不是图片:', reply_id);
            return;
        }
    }
    
    if (reply_id) {
        params.push(reply_id);
    }
    
    for (const sqc of allCommands) {
        if (sqc.command === command) {
            if (Math.floor(Date.now() / 1000) - sqc.last_call_time < sqc.cd) {
                continue;
            }
            const success = await sqc.execute(params, message);
            if (success) {
                sqc.last_call_time = Math.floor(Date.now() / 1000);
            }
            return;
            
        }
    }
        
}
    
    





export async function checkHumanVerification(message: Simplified_Messages): Promise<void> {
    if (message.message_type !== 'group') {
        return;
    }
    
    const needsVerification = await humanVerificationService.needsVerification(message.user_id, message.group_id);
    if (!needsVerification) {
      return;
    }

    const pendingVerification = await humanVerificationService.getPendingVerification(message.user_id, message.group_id);
    if (!pendingVerification) {
      return;
    }

    let messageText = '';
    for (const msg of message.message) {
        if (msg.type === 'text') {
            messageText += msg.data.text.trim();
        }
    }
    
    // 直接使用存储的expected_answer进行验证
    const expectedAnswer = pendingVerification.expected_answer;

    if (messageText === expectedAnswer) {
      await humanVerificationService.updateVerification(pendingVerification.id, {
        status: 'passed',
        user_answer: messageText
      });

      await quick_reply(message, '验证通过！欢迎加入群聊');
    } else {
      await humanVerificationService.incrementRetryTimes(pendingVerification.id);
      const newRetryTimes = (pendingVerification.retry_times || 0) + 1;
      
      // 从 key 中提取题目：格式为 时间戳-userId-question
      const keyParts = pendingVerification.key.split('-');
      const question = keyParts.slice(2).join('-'); // 题目可能包含 '-'，所以用 slice
      
      const handler = new SimpleAdditionHandler(0, 0); // 不再需要 num1, num2
      handler.question = question; // 直接使用题目
      await handleVerificationFailure(message, newRetryTimes, 3, handler);
      
      if (newRetryTimes >= 3) {
        await humanVerificationService.updateVerification(pendingVerification.id, {
          status: 'failed',
          retry_times: newRetryTimes
        });
      }
    }
}
