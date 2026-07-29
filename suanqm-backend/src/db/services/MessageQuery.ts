import { Repository, EntityManager } from 'typeorm';
import { AppDataSource, User, GroupChat, PrivateMessage, GroupMessage, GroupMember, Image } from '../database.js';
import type { UserEntity, GroupChatEntity, PrivateMessageEntity, GroupMessageEntity, GroupMemberEntity, ImageEntity } from '../database.js';
import { handle_messages } from '../../server/utils/format_messages.js';
import { Simplified_GroupMessage, Simplified_PrivateFriendMessage } from '../../server/utils/suanq_types.js';

interface GetMessagesOptions {
  group_id?: number;
  user_id?: number;
  target_id?: number;
  limit?: number;
  offset?: number;
  start_time?: number;
  end_time?: number;
  message_type?: 'group' | 'private';
}

export class MessageQuery {
  private userRepo: Repository<UserEntity>;
  private groupRepo: Repository<GroupChatEntity>;
  private groupMemberRepo: Repository<GroupMemberEntity>;
  private privateMsgRepo: Repository<PrivateMessageEntity>;
  private groupMsgRepo: Repository<GroupMessageEntity>;
  private imageRepo: Repository<ImageEntity>;
  private entityManager: EntityManager;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
    this.groupRepo = AppDataSource.getRepository(GroupChat);
    this.groupMemberRepo = AppDataSource.getRepository(GroupMember);
    this.privateMsgRepo = AppDataSource.getRepository(PrivateMessage);
    this.groupMsgRepo = AppDataSource.getRepository(GroupMessage);
    this.imageRepo = AppDataSource.getRepository(Image);
    this.entityManager = AppDataSource.manager;
  }

  /**
   * 获取群聊消息并转换为简化格式
   */
  async getGroupMessages(options: GetMessagesOptions): Promise<Simplified_GroupMessage[]> {
    const { group_id, user_id, limit = 20, offset = 0, start_time, end_time } = options;

    // 构建查询条件
    const queryBuilder = this.groupMsgRepo.createQueryBuilder('message')
      .where('message.status = 1');

    if (group_id) {
      queryBuilder.andWhere('message.group_id = :group_id', { group_id });
    }

    if (user_id) {
      queryBuilder.andWhere('message.user_id = :user_id', { user_id });
    }

    if (start_time) {
      queryBuilder.andWhere('message.time >= :start_time', { start_time });
    }

    if (end_time) {
      queryBuilder.andWhere('message.time <= :end_time', { end_time });
    }

    // 按时间降序排序
    const messages = await queryBuilder
      .orderBy('message.time', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    // 转换为简化格式
    return await Promise.all(messages.map(async (message) => {
      const simplifiedMessage: Simplified_GroupMessage = {
        user_id: message.user_id,
        time: message.time,
        message_id: message.message_id,
        message_seq: message.message_seq,
        real_id: message.real_id,
        message_type: "group",
        sender: {
          user_id: message.sender.user_id,
          nickname: message.sender.nickname,
          card: message.sender.card,
          role: message.sender.role
        },
        raw_message: message.raw_message,
        font: message.font,
        sub_type: "normal",
        post_type: "message",
        group_id: message.group_id,
        message_format: "array",
        message: await handle_messages(message.message, message.group_id),
        is_read: message.is_read
      };
      return simplifiedMessage;
    }));
  }

  /**
   * 获取私聊消息并转换为简化格式
   */
  async getPrivateMessages(options: GetMessagesOptions): Promise<Simplified_PrivateFriendMessage[]> {
    const { user_id, target_id, limit = 20, offset = 0, start_time, end_time } = options;

    // 构建查询条件
    const queryBuilder = this.privateMsgRepo.createQueryBuilder('message')
      .where('message.status = 1');

    if (user_id) {
      queryBuilder.andWhere('(message.user_id = :user_id OR message.target_id = :user_id)', { user_id });
    }

    if (target_id) {
      queryBuilder.andWhere('(message.user_id = :target_id OR message.target_id = :target_id)', { target_id });
    }

    if (start_time) {
      queryBuilder.andWhere('message.time >= :start_time', { start_time });
    }

    if (end_time) {
      queryBuilder.andWhere('message.time <= :end_time', { end_time });
    }

    // 按时间降序排序
    const messages = await queryBuilder
      .orderBy('message.time', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();

    // 转换为简化格式
    return await Promise.all(messages.map(async (message) => {
      const simplifiedMessage: Simplified_PrivateFriendMessage = {
        user_id: message.user_id,
        time: message.time,
        message_id: message.message_id,
        message_seq: message.message_seq,
        real_id: message.real_id,
        message_type: "private",
        sender: {
          user_id: message.sender.user_id,
          nickname: message.sender.nickname,
          card: message.sender.card
        },
        raw_message: message.raw_message,
        font: message.font,
        sub_type: "friend",
        post_type: "message",
        message_format: "array",
        message: await handle_messages(message.message),
        is_read: message.is_read
      };
      return simplifiedMessage;
    }));
  }

  /**
   * 根据ID获取单个消息并转换为简化格式
   */
  async getMessageById(messageId: number): Promise<Simplified_GroupMessage | Simplified_PrivateFriendMessage | null> {
    // 先尝试从群聊消息中查找
    let message = await this.groupMsgRepo.findOne({
      where: { message_id: messageId, status: 1 }
    });

    if (message) {
      // 转换为群聊消息简化格式
      return {
        user_id: message.user_id,
        time: message.time,
        message_id: message.message_id,
        message_seq: message.message_seq,
        real_id: message.real_id,
        message_type: "group",
        sender: {
          user_id: message.sender.user_id,
          nickname: message.sender.nickname,
          card: message.sender.card,
          role: message.sender.role
        },
        raw_message: message.raw_message,
        font: message.font,
        sub_type: "normal",
        post_type: "message",
        group_id: message.group_id,
        message_format: "array",
        message: await handle_messages(message.message, message.group_id),
        is_read: message.is_read
      };
    }

    // 再尝试从私聊消息中查找
    message = await this.privateMsgRepo.findOne({
      where: { message_id: messageId, status: 1 }
    }) as any;

    if (message) {
      // 转换为私聊消息简化格式
      return {
        user_id: message.user_id,
        time: message.time,
        message_id: message.message_id,
        message_seq: message.message_seq,
        real_id: message.real_id,
        message_type: "private",
        sender: {
          user_id: message.sender.user_id,
          nickname: message.sender.nickname,
          card: message.sender.card
        },
        raw_message: message.raw_message,
        font: message.font,
        sub_type: "friend",
        post_type: "message",
        message_format: "array",
        message: await handle_messages(message.message),
        is_read: message.is_read
      };
    }

    return null;
  }

  /**
   * 获取所有消息（群聊+私聊）并转换为简化格式
   */
  async getAllMessages(options: GetMessagesOptions): Promise<(Simplified_GroupMessage | Simplified_PrivateFriendMessage)[]> {
    if (options.message_type === 'group') {
      return await this.getGroupMessages(options);
    } else if (options.message_type === 'private') {
      return await this.getPrivateMessages(options);
    } else {
      // 获取群聊和私聊消息
      const groupMessages = await this.getGroupMessages(options);
      const privateMessages = await this.getPrivateMessages(options);

      // 合并并按时间排序
      return [...groupMessages, ...privateMessages]
        .sort((a, b) => b.time - a.time);
    }
  }

  /**
   * 获取消息中的图片信息
   */
  async getMessageImages(messageId: number): Promise<ImageEntity[]> {
    return await this.imageRepo.find({
      where: { message_id: messageId },
      order: { created_at: 'ASC' }
    });
  }

  /**
   * 获取群聊的最后一条消息
   */
  async getLastGroupMessage(groupId: number): Promise<Simplified_GroupMessage | null> {
    // 获取指定群聊的最后一条消息
    const message = await this.groupMsgRepo.findOne({
      where: { group_id: groupId, status: 1 },
      order: { time: 'DESC' }
    });

    if (!message) {
      return null;
    }

    // 转换为群聊消息简化格式
    return {
      user_id: message.user_id,
      time: message.time,
      message_id: message.message_id,
      message_seq: message.message_seq,
      real_id: message.real_id,
      message_type: "group",
      sender: {
        user_id: message.sender.user_id,
        nickname: message.sender.nickname,
        card: message.sender.card,
        role: message.sender.role
      },
      raw_message: message.raw_message,
      font: message.font,
      sub_type: "normal",
      post_type: "message",
      group_id: message.group_id,
      message_format: "array",
      message: await handle_messages(message.message, message.group_id),
      is_read: message.is_read
    };
  }

  /**
   * 获取私聊的最后一条消息
   */
  async getLastPrivateMessage(userId: number, targetId: number): Promise<Simplified_PrivateFriendMessage | null> {
    // 获取指定用户之间的最后一条私聊消息
    const message = await this.privateMsgRepo.findOne({
      where: [
        { user_id: userId, target_id: targetId, status: 1 },
        { user_id: targetId, target_id: userId, status: 1 }
      ],
      order: { time: 'DESC' }
    });

    if (!message) {
      return null;
    }

    // 转换为私聊消息简化格式
    return {
      user_id: message.user_id,
      time: message.time,
      message_id: message.message_id,
      message_seq: message.message_seq,
      real_id: message.real_id,
      message_type: "private",
      sender: {
        user_id: message.sender.user_id,
        nickname: message.sender.nickname,
        card: message.sender.card
      },
      raw_message: message.raw_message,
      font: message.font,
      sub_type: "friend",
      post_type: "message",
      message_format: "array",
      message: await handle_messages(message.message),
      is_read: message.is_read
    };
  }

  /**
   * 获取群聊未读消息数
   */
  async getGroupUnreadCount(groupId: number): Promise<number> {
    // 获取指定群聊的未读消息数
    return await this.groupMsgRepo.count({
      where: { group_id: groupId, status: 1, is_read: false }
    });
  }

  /**
   * 获取私聊未读消息数
   */
  async getPrivateUnreadCount(userId: number, targetId: number): Promise<number> {
    // 获取指定用户之间的未读消息数
    return await this.privateMsgRepo.count({
      where: {
        user_id: targetId,
        target_id: userId,
        status: 1,
        is_read: false
      }
    });
  }
}

// 导出单例实例
export const messageQuery = new MessageQuery();



