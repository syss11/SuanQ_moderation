import { Simplified_Messages } from "../server/utils/suanq_types";
import coAdminService from "../db/services/CoAdminService.js";
import { userService } from "../db/services/UserService.js";
import { quick_reply } from "./utils.js";

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

export default commands;