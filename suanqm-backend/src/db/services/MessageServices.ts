import { Repository } from 'typeorm';
import { AppDataSource } from '../database.js';
import { 
  GroupChat, 
  PrivateMessage as PrivateMessageEntity, 
  GroupMessage as GroupMessageEntity, 
  GroupMember ,Image
} from '../entities/index.js';
import type { AllHandlers, GroupMessage as NapcatGroupMessage, PrivateFriendMessage as NapcatPrivateMessage } from "node-napcat-ts";
import { userService } from './UserService.js';
import { logger } from '../../logger.js';
import { getConfig } from '../../config/index.js';

export class MessageService {
  private groupRepo: Repository<GroupChat>;
  private groupMemberRepo: Repository<GroupMember>;
  private privateMsgRepo: Repository<PrivateMessageEntity>;
  private groupMsgRepo: Repository<GroupMessageEntity>;
  private imageRepo: Repository<Image>;

  constructor() {
    this.groupRepo = AppDataSource.getRepository(GroupChat);
    this.groupMemberRepo = AppDataSource.getRepository(GroupMember);
    this.privateMsgRepo = AppDataSource.getRepository(PrivateMessageEntity);
    this.groupMsgRepo = AppDataSource.getRepository(GroupMessageEntity);
    this.imageRepo = AppDataSource.getRepository(Image);
  }

  /**
   * 保存群聊消息
   */
  async saveGroupMessage(context: NapcatGroupMessage): Promise<GroupMessageEntity> {
    try {
      // 确保用户存在
      const user = await userService.ensureUser({
        qq_id: context.sender.user_id,
        nickname: context.sender.nickname
      });

      // 确保群聊存在
      const group = await this.ensureGroup({
        group_id: context.group_id
      });

      // 确保群成员信息
      await this.ensureGroupMember({
        group_id: context.group_id as number,
        user_id: context.user_id as number,
        card: context.sender.card,
        role: context.sender.role || 'member'
      });

      // 从 context 中提取 message 和 message_format
      const { quick_action, ...messageData } = context as any;
      const { message, message_format, ...restData } = messageData;
      
      const groupMessage = this.groupMsgRepo.create({
        self_id: context.self_id,
        user_id: context.user_id,
        time: context.time,
        message_id: context.message_id,
        message_seq: context.message_seq,
        real_id: context.real_id,
        message_type: context.message_type,
        sender: {
          user_id: context.sender.user_id,
          nickname: context.sender.nickname,
          card: context.sender.card,
          role: context.sender.role
        },
        raw_message: context.raw_message,
        font: context.font,
        sub_type: context.sub_type,
        message: message || [],
        message_format: message_format || 'array',
        post_type: context.post_type,
        group_id: context.group_id,
      });

      const savedMessage = await this.groupMsgRepo.save(groupMessage);
      
      try {
        const savedImages = await save_images_from_message(context);
        if (savedImages.length > 0) {
          for (const img of savedImages) {
            if (!img.success || !img.path || !img.md5 || img.phash === undefined || img.phash === null) {
             continue;
            }
            
            try {
              const existingImage = await this.imageRepo.findOne({
                where: { md5: img.md5 }
              });

              if (!existingImage) {
                const newImage = this.imageRepo.create({
                  filename: img.name,
                  path: img.path,
                  size: img.size || 0,
                  message_id: context.message_id,
                  image_url: img.url,
                  md5: img.md5,
                  phash: img.phash?.toString()
                });
                await this.imageRepo.save(newImage);
                logger.log(`图片已保存到数据库: ${img.name}, MD5: ${img.md5}`);
              } else {
                existingImage.message_id = context.message_id;
                existingImage.phash = img.phash?.toString();
                await this.imageRepo.save(existingImage);
                }
            } catch (dbError) {
              logger.error(`保存图片到数据库失败: ${img.name}`, dbError);
            }
          }
        }
      } catch (imageError) {
        logger.error('处理图片失败:', imageError);
      }

      return savedMessage;

    } catch (error) {
      logger.error('保存群聊消息失败:', error);
      throw error;
    }
  }

  /**
   * 保存私聊消息
   */
  async savePrivateMessage(context: NapcatPrivateMessage): Promise<PrivateMessageEntity> {
    try {
      // 确保用户存在
      const user = await userService.ensureUser({
        qq_id: context.sender.user_id,
        nickname: context.sender.nickname
      });

      // 从 context 中提取 message 和 message_format
      const { quick_action, ...messageData } = context as any;
      const { message, message_format, ...restData } = messageData;
      
      const privateMessage = this.privateMsgRepo.create({
        self_id: context.self_id,
        user_id: context.user_id,
        time: context.time,
        message_id: context.message_id,
        message_seq: context.message_seq,
        real_id: context.real_id,
        message_type: context.message_type,
        sender: {
          user_id: context.sender.user_id,
          nickname: context.sender.nickname,
          card: context.sender.card
        },
        raw_message: context.raw_message,
        font: context.font,
        sub_type: context.sub_type,
        message: message || [],
        message_format: message_format || 'array',
        post_type: context.post_type,
        target_id: context.user_id, // 注意：根据类型，私聊消息没有单独的 target_id 字段
      });

      const savedMessage = await this.privateMsgRepo.save(privateMessage);
     
      try {
        const savedImages = await save_images_from_message(context);
        if (savedImages.length > 0) {
          for (const img of savedImages) {
            if (!img.success || !img.path || !img.md5) {
              logger.log(`跳过无效图片: ${img.name}, MD5: ${img.md5 || 'N/A'}`);
              continue;
            }
            
            try {
              const existingImage = await this.imageRepo.findOne({
                where: { md5: img.md5 }
              });

              if (!existingImage) {
                const newImage = this.imageRepo.create({
                  filename: img.name,
                  path: img.path,
                  size: img.size || 0,
                  message_id: context.message_id,
                  image_url: img.url,
                  md5: img.md5
                });
                await this.imageRepo.save(newImage);
                logger.log(`图片已保存到数据库: ${img.name}, MD5: ${img.md5}`);
              } else {
                logger.log(`图片已存在于数据库: ${img.name}, MD5: ${img.md5}`);
              }
            } catch (dbError) {
              logger.error(`保存图片到数据库失败: ${img.name}`, dbError);
            }
          }
        }
      } catch (imageError) {
        logger.error('处理图片失败:', imageError);
      }
      return savedMessage;

    } catch (error) {
      logger.error('保存私聊消息失败:', error);
      throw error;
    }
  }

  /**
   * 处理接收到的消息
   */
  async processMessage(context: NapcatGroupMessage | NapcatPrivateMessage) {
    if (context.message_type === 'private') {
      return await this.savePrivateMessage(context as NapcatPrivateMessage);
    } else if (context.message_type === 'group') {
      return await this.saveGroupMessage(context as NapcatGroupMessage);
    } else {
      
    }
  }

  /**
   * 确保群聊存在
   */
  async ensureGroup(groupData: { group_id: number; name?: string; member_count?: number }) {
    let group = await this.groupRepo.findOne({ where: { group_id: groupData.group_id } });
    
    if (!group) {
      group = this.groupRepo.create({
        group_id: groupData.group_id,
        name: groupData.name,
        member_count: groupData.member_count || 0
      });
      group = await this.groupRepo.save(group);
    } else {
      let needsUpdate = false;
      
      if (groupData.name && group.name !== groupData.name) {
        group.name = groupData.name;
        needsUpdate = true;
      }
      
      if (groupData.member_count !== undefined && group.member_count !== groupData.member_count) {
        group.member_count = groupData.member_count;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        group = await this.groupRepo.save(group);
      }
    }
    
    return group;
  }

  /**
   * 获取群成员数量
   */
  async getGroupMemberCount(group_id: number): Promise<number> {
    try {
      const group = await this.groupRepo.findOne({ where: { group_id } });
      return group ? group.member_count : 0;
    } catch (error) {
      logger.error('获取群成员数量失败:', error);
      return 0;
    }
  }

  /**
   * 确保群成员信息
   */
  async ensureGroupMember(memberData: { 
    group_id: number; 
    user_id: number; 
    card: string; 
    role: 'owner' | 'admin' | 'member';
  }) {
    await this.ensureGroup({ group_id: memberData.group_id });
    
    let member = await this.groupMemberRepo.findOne({
      where: {
        group_id: memberData.group_id,
        user_id: memberData.user_id
      }
    });
    
    if (!member) {
      member = this.groupMemberRepo.create({
        group_id: memberData.group_id,
        user_id: memberData.user_id,
        card: memberData.card,
        role: memberData.role,
        credit: getConfig().user.credit.default,
        status: true
      });
      member = await this.groupMemberRepo.save(member);
    } else if (member.card !== memberData.card || member.role !== memberData.role || !member.status) {
      member.card = memberData.card;
      member.role = memberData.role;
      member.status = true;
      member = await this.groupMemberRepo.save(member);
    }
    
    return member;
  }

  /**
   * 更新群成员状态
   */
  async updateGroupMemberStatus(group_id: number, user_id: number, status: boolean): Promise<boolean> {
    try {
      const result = await this.groupMemberRepo.update(
        { group_id, user_id },
        { status }
      );
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新群成员状态失败:', error);
      return false;
    }
  }

  /**
   * 查询群聊消息
   */
  async getGroupMessages(options: {
    group_id?: number;
    user_id?: number;
    start_time?: number;
    end_time?: number;
    limit?: number;
    offset?: number;
  }) {
    const { 
      group_id, 
      user_id, 
      start_time, 
      end_time, 
      limit = 50, 
      offset = 0 
    } = options;

    const query = this.groupMsgRepo
      .createQueryBuilder('message')
      .orderBy('message.time', 'DESC')
      .take(limit)
      .skip(offset);

    if (group_id) {
      query.andWhere('message.group_id = :group_id', { group_id });
    }
    if (user_id) {
      query.andWhere('message.user_id = :user_id', { user_id });
    }
    if (start_time) {
      query.andWhere('message.time >= :start_time', { start_time });
    }
    if (end_time) {
      query.andWhere('message.time <= :end_time', { end_time });
    }

    return await query.getManyAndCount();
  }

  /**
   * 查询私聊消息
   */
  async getPrivateMessages(options: {
    user_id?: number;
    start_time?: number;
    end_time?: number;
    limit?: number;
    offset?: number;
  }) {
    const { 
      user_id, 
      start_time, 
      end_time, 
      limit = 50, 
      offset = 0 
    } = options;

    const query = this.privateMsgRepo
      .createQueryBuilder('message')
      .orderBy('message.time', 'DESC')
      .take(limit)
      .skip(offset);

    if (user_id) {
      query.andWhere('message.user_id = :user_id', { user_id });
    }
    if (start_time) {
      query.andWhere('message.time >= :start_time', { start_time });
    }
    if (end_time) {
      query.andWhere('message.time <= :end_time', { end_time });
    }

    return await query.getManyAndCount();
  }

  /**
   * 获取用户在群组中的角色
   */
  async getUserGroupRole(groupId: number, userId: number): Promise<string | null> {
    try {
      const member = await this.groupMemberRepo.findOne({
        where: {
          group_id: groupId,
          user_id: userId
        }
      });
      
      return member ? member.role : null;
    } catch (error) {
      logger.error('获取用户群组角色失败:', error);
      return null;
    }
  }

  /**
   * 获取上一条群消息的发送者（排除机器人）
   */
  async getLastGroupMessageSender(groupId: number, currentTime: number, timeWindow: number = 5): Promise<number | null> {
    try {
      const timeThreshold = currentTime - timeWindow;
      
      const result = await this.groupMsgRepo
        .createQueryBuilder('message')
        .where('message.group_id = :groupId', { groupId })
        .andWhere('message.time < :currentTime', { currentTime })
        .andWhere('message.time >= :timeThreshold', { timeThreshold })
        .orderBy('message.time', 'DESC')
        .limit(1)
        .getOne();
      
      return result ? result.user_id : null;
    } catch (error) {
      logger.error('获取上一条群消息发送者失败:', error);
      return null;
    }
  }

  /**
   * 获取最新的非机器人群消息发送者
   */
  async getLastNonRobotGroupMessageSender(groupId: number, currentTime: number, timeWindow: number = 30): Promise<number | null> {
    try {
      const timeThreshold = currentTime - timeWindow;
      
      const { is_robot } = await import('../../napcat/utils.js');
      
      const results = await this.groupMsgRepo
        .createQueryBuilder('message')
        .where('message.group_id = :groupId', { groupId })
        .andWhere('message.time < :currentTime', { currentTime })
        .andWhere('message.time >= :timeThreshold', { timeThreshold })
        .orderBy('message.time', 'DESC')
        .limit(10)
        .getMany();
      
      for (const message of results) {
        if (!is_robot(message.user_id)) {
          return message.user_id;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('获取最新非机器人群消息发送者失败:', error);
      return null;
    }
  }

  /**
   * 更新群聊消息状态为已撤回
   */
  async recallGroupMessage(messageId: number): Promise<boolean> {
    try {
      const result = await this.groupMsgRepo.update(
        { message_id: messageId },
        { status: 0 }
      );
      
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新群聊消息状态失败:', error);
      return false;
    }
  }

  /**
   * 更新私聊消息状态为已撤回
   */
  async recallPrivateMessage(messageId: number): Promise<boolean> {
    try {
      const result = await this.privateMsgRepo.update(
        { message_id: messageId },
        { status: 0 }
      );
      
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新私聊消息状态失败:', error);
      return false;
    }
  }

  /**
   * 根据消息ID获取群聊消息
   */
  async getGroupMessageById(messageId: number): Promise<GroupMessageEntity | null> {
    try {
      const message = await this.groupMsgRepo.findOne({
        where: { message_id: messageId }
      });
      return message;
    } catch (error) {
      logger.error('获取群聊消息失败:', error);
      return null;
    }
  }

  /**
   * 根据消息ID获取私聊消息
   */
  async getPrivateMessageById(messageId: number): Promise<PrivateMessageEntity | null> {
    try {
      const message = await this.privateMsgRepo.findOne({
        where: { message_id: messageId }
      });
      return message;
    } catch (error) {
      logger.error('获取私聊消息失败:', error);
      return null;
    }
  }
}
import { save_images_from_message } from '../../napcat/utils.js';
// 导出单例实例
export const messageService = new MessageService();