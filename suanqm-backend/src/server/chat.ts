import express, { Request, Response } from 'express';
import napcat from "../napcat/index.js";
import { authMiddleware } from './middleware/auth.js';
import { get_avatar_url_by_groupid, get_avatar_url_by_userid } from '../napcat/utils.js';
import { Simplified_GroupMessage, Simplified_PrivateFriendMessage } from './utils/suanq_types.js';
import { messageQuery } from '../db/services/MessageQuery.js';
import { logger } from '../logger.js';
import { checkWhitelistBlacklist } from '../handler/index.js';

const router = express.Router();

// 定义简化的数据结构类型
type SimplifiedGroup = {
    group_id: number;
    group_name: string;
    group_remark: string;
    avatar_url: string;
    chat_extra: ChatExtra;
};

type SimplifiedFriend = {
    user_id: number;
    nickname: string;
    remark: string;
    avatar_url: string;
    chat_extra: ChatExtra;
};

type ChatExtra ={
    last_message: Simplified_PrivateFriendMessage | Simplified_GroupMessage | null;
    unread_count: number;
}

// 获取群聊列表路由
router.get('/api/chat/groups', authMiddleware, async (req: Request, res: Response) => {
    try {
        // 使用napcat获取群聊列表
        const groups = await napcat.get_group_list();
        
        // 根据黑白名单过滤群列表
        const filteredGroups = groups.filter(group => {
            return checkWhitelistBlacklist('group', Number(group.group_id));
        });
        
        // 转换为简化格式并添加最后一条消息和未读消息数
        const simplifiedGroups = await Promise.all(filteredGroups.map(async (group) => {
            // 获取最后一条消息
            const lastMessage = await messageQuery.getLastGroupMessage(group.group_id);
            
            // 获取未读消息数
            const unreadCount = await messageQuery.getGroupUnreadCount(group.group_id);
            
            return {
                group_id: group.group_id,
                group_name: group.group_name,
                group_remark: group.group_remark,
                avatar_url: get_avatar_url_by_groupid(group.group_id),
                chat_extra: {
                    last_message: lastMessage,
                    unread_count: unreadCount
                }
            };
        }));
        
        res.status(200).json({
            code: 200,
            data: simplifiedGroups,
            message: '获取群聊列表成功'
        });
    } catch (error) {
        logger.error('获取群聊列表失败:', error);
        res.status(500).json({
            code: 500,
            message: '获取群聊列表失败'
        });
    }
});

// 获取好友列表路由
router.get('/api/chat/friends', authMiddleware, async (req: Request, res: Response) => {
    try {
        // 使用napcat获取好友列表
        const friends = await napcat.get_friend_list();
        
        // 获取机器人自身ID
        const selfId =await napcat.get_login_info();
        const selfIdNumber = selfId.user_id;
        
        // 转换为简化格式并添加最后一条消息和未读消息数
        const simplifiedFriends = await Promise.all(friends.map(async (friend) => {
            // 获取最后一条消息
            const lastMessage = await messageQuery.getLastPrivateMessage(selfIdNumber, friend.user_id);
            
            // 获取未读消息数
            const unreadCount = await messageQuery.getPrivateUnreadCount(selfIdNumber, friend.user_id);
            
            return {
                user_id: friend.user_id,
                nickname: friend.nickname,
                remark: friend.remark,
                avatar_url: get_avatar_url_by_userid(friend.user_id),
                chat_extra: {
                    last_message: lastMessage,
                    unread_count: unreadCount
                }
            };
        }));
        
        res.status(200).json({
            code: 200,
            data: simplifiedFriends,
            message: '获取好友列表成功'
        });
    } catch (error) {
        logger.error('获取好友列表失败:', error);
        res.status(500).json({
            code: 500,
            message: '获取好友列表失败'
        });
    }
});

// 获取群成员列表路由
router.get('/api/chat/group/members', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { groupId } = req.query;
        
        if (!groupId) {
            return res.status(400).json({
                code: 400,
                message: '缺少groupId参数'
            });
        }
        
        // 使用napcat获取群成员列表
        const members = await napcat.get_group_member_list({
            group_id: parseInt(groupId as string)
        });
        
        // 转换为简化格式
        const simplifiedMembers = members.map(member => ({
            user_id: member.user_id,
            nickname: member.nickname,
            card: member.card || '',
            sex: member.sex,
            avatar_url: get_avatar_url_by_userid(member.user_id)
        }));
        
        res.status(200).json({
            code: 200,
            data: simplifiedMembers,
            message: '获取群成员列表成功'
        });
    } catch (error) {
        logger.error('获取群成员列表失败:', error);
        res.status(500).json({
            code: 500,
            message: '获取群成员列表失败'
        });
    }
});

export default router;