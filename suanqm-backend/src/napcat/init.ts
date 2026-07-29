import napcat from "./index.js";
import { self_id } from "./main.js";
import { userService } from "../db/services/UserService.js";
import { messageService } from "../db/services/MessageServices.js";
import userInteractionService from "../db/services/UserInteractionService.js";
import { logger } from "../logger.js";
import { checkWhitelistBlacklist } from "../handler/index.js";





type GroupInfo =
{
    group_all_shut: number;
    group_remark: string;
    group_id: number;
    group_name: string;
    member_count: number;
    max_member_count: number;
}

class GroupMetaInfo{
    private group_list: GroupInfo[] = [];
    public group_role : Record<number,'admin'|'owner'|'member'> = {};


    constructor(){
       
    }

    async init_groups(){
        this.group_list = await napcat.get_group_list();
        this.group_list = this.group_list.filter(g => checkWhitelistBlacklist('group', g.group_id));
    }

    async get_my_role(group_id: number){
        if (this.group_role[group_id]){
            return this.group_role[group_id];
        }else{
            const grinfo = await napcat.get_group_member_info({
                group_id: group_id,
                user_id: self_id,
            });
            
            this.group_role[group_id] = grinfo.role as 'admin'|'owner'|'member';
            return this.group_role[group_id];
        }
    }

    async ensure_group_users(group_id: number){
        try {
            const groupInfo = this.group_list.find(g => g.group_id === group_id);
            const groupName = groupInfo?.group_name;

            await messageService.ensureGroup({
                group_id: group_id,
                name: groupName
            });

            const members = await napcat.get_group_member_list({
                group_id: group_id,
            });

            const dbMemberCount = await messageService.getGroupMemberCount(group_id);

            if (dbMemberCount === members.length) {
                return { success: 0, failed: 0, total: members.length, skipped: true };
            }

            let successCount = 0;
            let failCount = 0;

            for (const member of members) {
                try {
                    await userService.ensureUser({
                        qq_id: member.user_id,
                        nickname: member.nickname
                    });

                    await messageService.ensureGroupMember({
                        group_id: group_id,
                        user_id: member.user_id,
                        card: member.card || '',
                        role: member.role || 'member'
                    });

                    successCount++;
                } catch (error) {
                    logger.error(`同步用户 ${member.user_id} 失败:`, error);
                    failCount++;
                }
            }

            await messageService.ensureGroup({
                group_id: group_id,
                name: groupName,
                member_count: members.length
            });

            const memberIds = members.map(m => m.user_id);
            await userInteractionService.initializeForGroupMembers(group_id, memberIds);

            logger.log(`群 ${group_id} (${groupName}) 成员同步完成: 成功 ${successCount} 人, 失败 ${failCount} 人`);
            return { success: successCount, failed: failCount, total: members.length, skipped: false };
        } catch (error) {
            logger.error(`获取群 ${group_id} 成员列表失败:`, error);
            throw error;
        }
    }

    async ensure_all_groups_users(){
        await this.init_groups();
        logger.log(`开始同步所有群成员信息，共 ${this.group_list.length} 个群`);
        logger.log('此过程初次运行，可能需要时间，请耐心等待');
        const results = [];
        let totalSkipped = 0;
        let totalSynced = 0;

        for (const group of this.group_list) {
            try {
                const result = await this.ensure_group_users(group.group_id);
                results.push({
                    group_id: group.group_id,
                    group_name: group.group_name,
                    ...result
                });
                
                if (result.skipped) {
                    totalSkipped++;
                } else {
                    totalSynced++;
                }
            } catch (error) {
                 results.push({
                    group_id: group.group_id,
                    group_name: group.group_name,
                    success: 0,
                    failed: 0,
                    total: 0,
                    skipped: false,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        logger.log('所有群成员同步完成');
        logger.log(`统计: 共 ${this.group_list.length} 个群，跳过 ${totalSkipped} 个，同步 ${totalSynced} 个`);
        return results;
    }
}

export const groupMetaInfo = new GroupMetaInfo();