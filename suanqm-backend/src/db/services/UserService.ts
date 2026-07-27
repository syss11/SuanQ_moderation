import { Repository } from 'typeorm';
import { AppDataSource } from '../database.js';
import { User } from '../entities/User.js';
import { GroupMember } from '../entities/GroupMember.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../logger.js';

export class UserService {
  private userRepo: Repository<User>;
  private groupMemberRepo: Repository<GroupMember>;

  constructor() {
    this.userRepo = AppDataSource.getRepository(User);
    this.groupMemberRepo = AppDataSource.getRepository(GroupMember);
  }

  /**
   * 确保用户存在
   */
  async ensureUser(userData: { qq_id: number; nickname: string }) {
    let user = await this.userRepo.findOne({ where: { qq_id: userData.qq_id } });
    
    if (!user) {
      user = this.userRepo.create({
        qq_id: userData.qq_id,
        nickname: userData.nickname,
      });
      user = await this.userRepo.save(user);
    } else if (user.nickname !== userData.nickname) {
      user.nickname = userData.nickname;
      user = await this.userRepo.save(user);
    }
    
    return user;
  }

  /**
   * 根据QQ号查询用户
   */
  async getUserByQQId(qq_id: number): Promise<User | null> {
    try {
      return await this.userRepo.findOne({ where: { qq_id } });
    } catch (error) {
      logger.error('查询用户失败:', error);
      return null;
    }
  }

  /**
   * 根据ID查询用户
   */
  async getUserById(id: number): Promise<User | null> {
    try {
      return await this.userRepo.findOne({ where: { id } });
    } catch (error) {
      logger.error('查询用户失败:', error);
      return null;
    }
  }

  /**
   * 查询用户在群组中的信誉分
   */
  async getUserGroupCredit(groupId: number, userId: number): Promise<number | null> {
    try {
      const member = await this.groupMemberRepo.findOne({
        where: {
          group_id: groupId,
          user_id: userId
        }
      });
      return member ? member.credit : null;
    } catch (error) {
      logger.error('查询用户群组信誉分失败:', error);
      return null;
    }
  }

  /**
   * 更新用户在群组中的信誉分
   */
  async updateUserGroupCredit(groupId: number, userId: number, credit: number): Promise<boolean> {
    try {
      const result = await this.groupMemberRepo.update(
        { group_id: groupId, user_id: userId },
        { credit }
      );
      
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新用户群组信誉分失败:', error);
      return false;
    }
  }

  /**
   * 增加用户在群组中的信誉分
   */
  async increaseUserGroupCredit(groupId: number, userId: number, amount: number): Promise<number | null> {
    try {
      const member = await this.groupMemberRepo.findOne({
        where: {
          group_id: groupId,
          user_id: userId
        }
      });
      if (!member) {
        return null;
      }
      
      member.credit += amount;
      await this.groupMemberRepo.save(member);
      
      return member.credit;
    } catch (error) {
      logger.error('增加用户群组信誉分失败:', error);
      return null;
    }
  }

  /**
   * 减少用户在群组中的信誉分
   */
  async decreaseUserGroupCredit(groupId: number, userId: number, amount: number): Promise<number | null> {
    try {
      const member = await this.groupMemberRepo.findOne({
        where: {
          group_id: groupId,
          user_id: userId
        }
      });
      if (!member) {
        return null;
      }
      
      member.credit -= amount;
      await this.groupMemberRepo.save(member);
      
      return member.credit;
    } catch (error) {
      logger.error('减少用户群组信誉分失败:', error);
      return null;
    }
  }

  /**
   * 更新用户昵称
   */
  async updateUserNickname(qq_id: number, nickname: string): Promise<boolean> {
    try {
      const result = await this.userRepo.update(
        { qq_id },
        { nickname }
      );
      
      return (result.affected || 0) > 0;
    } catch (error) {
      logger.error('更新用户昵称失败:', error);
      return false;
    }
  }

  /**
   * 获取所有用户
   */
  async getAllUsers(options: {
    limit?: number;
    offset?: number;
  } = {}): Promise<{ users: User[]; total: number }> {
    try {
      const { limit = 50, offset = 0 } = options;
      
      const [users, total] = await this.userRepo.findAndCount({
        order: { created_at: 'DESC' },
        take: limit,
        skip: offset
      });
      
      return { users, total };
    } catch (error) {
      logger.error('获取用户列表失败:', error);
      return { users: [], total: 0 };
    }
  }

  /**
   * 获取群成员credit列表，从小到大排序
   */
  async getGroupCredits(groupId: number, maxCredit?: number): Promise<{ user_id: number; nickname: string; credit: number }[]> {
    try {
      const queryBuilder = this.groupMemberRepo.createQueryBuilder('member')
        .select([
          'member.user_id',
          'u.nickname',
          'member.credit'
        ])
        .innerJoin('user', 'u', 'member.user_id = u.id')
        .where('member.group_id = :groupId', { groupId })
        .orderBy('member.credit', 'ASC');
      
      if (maxCredit !== undefined) {
        queryBuilder.andWhere('member.credit < :maxCredit', { maxCredit });
      }
      
      const members = await queryBuilder.getRawMany();
      
      return members.map(m => ({
        user_id: m.user_id,
        nickname: m.nickname,
        credit: m.credit
      }));
    } catch (error) {
      logger.error('获取群成员credit列表失败:', error);
      return [];
    }
  }

  /**
   * 根据信誉分范围查询用户
   */
  async getUsersByCreditRange(minCredit: number, maxCredit: number): Promise<User[]> {
    try {
      return await this.userRepo
        .createQueryBuilder('user')
        .where('user.credit >= :minCredit', { minCredit })
        .andWhere('user.credit <= :maxCredit', { maxCredit })
        .orderBy('user.credit', 'DESC')
        .getMany();
    } catch (error) {
      logger.error('根据信誉分范围查询用户失败:', error);
      return [];
    }
  }
}

export const userService = new UserService();
