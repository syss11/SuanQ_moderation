import { Simplified_Messages } from "../server/utils/suanq_types";
import coAdminService from "../db/services/CoAdminService.js";
import { userService } from "../db/services/UserService.js";
import { suppressionService } from "../db/services/SuppressionService.js";
import { quick_reply } from "./utils.js";
import { getConfig } from "../config/index.js";

function getSuppressionRegenBase(): number {
  return getConfig()?.helper?.suppression?.regen_base ?? 0.0833;
}

function getResetEnergyOnSupp(): boolean {
  return getConfig()?.helper?.suppression?.reset_energy_on_supp ?? true;
}

const commands: any[] = [];

function createCommand(cmd: {
    command: string,
    description?: string,
    params: { name: string; type: 'string' | 'number' | 'boolean'; default?: string | number | boolean }[],
    cd: number,
    auth?: 'member' | 'admin' | 'owner',
    supportCoAdmin?: boolean,
    callback: (params: Record<string, string | number | boolean>, message: Simplified_Messages) => Promise<void>
}) {
    commands.push(cmd);
}

createCommand({
    command: 'ruling',
    description: '查看我的裁决点',
    params: [],
    cd: 5,
    callback: async (params, message) => {
        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用', true);
            return;
        }

        const coAdmin = await coAdminService.getByUserId(message.user_id, message.group_id);
        if (!coAdmin) {
            await quick_reply(message, '你不是协管，没有裁决点', true);
            return;
        }

        await quick_reply(message, `裁决点: ${coAdmin.ruling}/${coAdmin.max_ruling}`);
    }
});

createCommand({
    command: 'coadminlist',
    description: '查看群协管列表',
    params: [],
    cd: 10,
    auth: 'admin',
    callback: async (params, message) => {
        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用', true);
            return;
        }

        const coAdmins = await coAdminService.getAllActiveByGroup(message.group_id);
        if (coAdmins.length === 0) {
            await quick_reply(message, '本群暂无协管');
            return;
        }

        let reply = '群协管列表:\n';
        for (const admin of coAdmins) {
            const user = await userService.getUserByQQId(admin.user_id);
            const nickname = user?.nickname || '未知用户';
            reply += `${nickname}(${admin.user_id}) | 裁决点: ${admin.ruling}/${admin.max_ruling}\n`;
        }
        await quick_reply(message, reply.trim());
    }
});

createCommand({
    command: 'addcoadmin',
    description: '添加群协管',
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
        try {
            await coAdminService.create(userId, message.group_id);
            await quick_reply(message, `已添加协管: ${userId}`);
        } catch (error) {
            await quick_reply(message, `添加失败，该用户可能已为协管`, true);
        }
    }
});

createCommand({
    command: 'removecoadmin',
    description: '移除群协管',
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
        const success = await coAdminService.delete(userId, message.group_id);
        if (success) {
            await quick_reply(message, `已移除协管: ${userId}`);
        } else {
            await quick_reply(message, `移除失败，该用户不是协管`, true);
        }
    }
});

createCommand({
    command: 'setruling',
    description: '设置协管裁决点',
    params: [
        { name: 'userId', type: 'number' },
        { name: 'ruling', type: 'number' }
    ],
    cd: 2,
    auth: 'admin',
    callback: async (params, message) => {
        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用', true);
            return;
        }

        const userId = params.userId as number;
        const ruling = params.ruling as number;
        const success = await coAdminService.update(userId, message.group_id, { ruling });
        if (success) {
            await quick_reply(message, `已设置 ${userId} 的裁决点为: ${ruling}`);
        } else {
            await quick_reply(message, `设置失败，该用户不是协管`, true);
        }
    }
});

createCommand({
    command: 'setmaxruling',
    description: '设置协管最大裁决点',
    params: [
        { name: 'userId', type: 'number' },
        { name: 'maxRuling', type: 'number' }
    ],
    cd: 2,
    auth: 'admin',
    callback: async (params, message) => {
        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用', true);
            return;
        }

        const userId = params.userId as number;
        const maxRuling = params.maxRuling as number;
        const success = await coAdminService.update(userId, message.group_id, { max_ruling: maxRuling });
        if (success) {
            await quick_reply(message, `已设置 ${userId} 的最大裁决点为: ${maxRuling}`);
        } else {
            await quick_reply(message, `设置失败，该用户不是协管`, true);
        }
    }
});

createCommand({
    command: 'deduct',
    description: '扣除用户信誉分',
    params: [
        { name: 'userId', type: 'number' },
        { name: 'amount', type: 'number', default: 1 }
    ],
    cd: 2,
    auth: 'admin',
    supportCoAdmin: true,
    callback: async (params, message) => {
        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用', true);
            return;
        }

        const userId = params.userId as number;
        const amount = params.amount as number ?? 1;

        if (amount <= 0) {
            await quick_reply(message, '扣除数量必须大于0', true);
            return;
        }

        const newCredit = await userService.decreaseUserGroupCredit(message.group_id, userId, amount);
        if (newCredit === null) {
            await quick_reply(message, '扣除失败，该用户不在群成员列表中', true);
            return;
        }

        await quick_reply(message, `操作成功(-${amount})，当前信誉分: ${newCredit}`);
    }
});

createCommand({
    command: 'supp',
    description: '压制成员（发言消耗精力，精力不足禁言）。持续时间：负数=不限时长，0=取消。',
    params: [
        { name: 'userId', type: 'number' },
        { name: 'duration', type: 'number' },
        { name: 'regenMultiplier', type: 'number', default: 1 }
    ],
    cd: 2,
    auth: 'admin',
    supportCoAdmin: true,
    callback: async (params, message) => {
        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用', true);
            return;
        }

        const userId = params.userId as number;
        const duration = params.duration as number;
        const regenMultiplier = (params.regenMultiplier as number) ?? 1;

        if (!Number.isFinite(userId)) {
            await quick_reply(message, '成员ID无效', true);
            return;
        }

        // 0 = 取消压制
        if (duration === 0) {
            const ok = await suppressionService.setStatus(userId, message.group_id, false);
            if (ok) {
                await quick_reply(message, `已取消压制: ${userId}`);
            } else {
                await quick_reply(message, `取消失败，该用户未被压制`, true);
            }
            return;
        }

        if (!Number.isFinite(duration)) {
            await quick_reply(message, '持续时间无效', true);
            return;
        }

        if (!Number.isFinite(regenMultiplier) || regenMultiplier < 0) {
            await quick_reply(message, '精力回复倍率必须为非负数', true);
            return;
        }

        const regen = getSuppressionRegenBase() * regenMultiplier;

        try {
            const saved = await suppressionService.upsert(userId, message.group_id, {
                status: true,
                periodSec: duration,   // 负数=不限时长，正数=秒数
                regen_per_second: regen,
            });

            // 根据配置决定是否重置精力为上限
            if (getResetEnergyOnSupp()) {
                const resetVal = await suppressionService.resetEnergy(userId, message.group_id);
                if (resetVal !== null) saved.energy = resetVal;
            }

            const durationText = saved.period < 0
                ? '不限时长'
                : `${saved.period}秒`;
            const remainingText = saved.period < 0
                ? '永久'
                : `${suppressionService.getRemainingSec(saved)}秒`;

            await quick_reply(
                message,
                `执行压制成功\n` +
                `时长: ${durationText} ` +
                `精力: ${Math.floor(saved.energy)}/${Math.floor(saved.max_energy)}\n` +
                `回复速率: ${(saved.regen_per_second * 60).toFixed(1)}/min\n`+
                '发言将消耗精力，精力不足将会被禁言！'
            );
        } catch (error: any) {
            await quick_reply(message, `压制失败: ${error?.message || error}`, true);
        }
    }
});


createCommand({
    command: 'energy',
    description: '查询我的精力值（仅被压制时）',
    params: [],
    cd: 5,
    callback: async (params, message) => {
        if (message.message_type !== 'group') {
            await quick_reply(message, '此命令仅限群聊使用', true);
            return;
        }

        const energy = await suppressionService.getEnergy(message.user_id, message.group_id);
        if (energy === null) {
            await quick_reply(message, '当前未处于压制状态，无精力值');
            return;
        }
        await quick_reply(message, `当前精力: ${Math.floor(energy)}`);
    }
});


export default commands;