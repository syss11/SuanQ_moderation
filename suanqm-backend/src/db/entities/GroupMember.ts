import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from './User.js';
import { GroupChat } from './GroupChat.js';

@Entity('group_members')
export class GroupMember {
  @PrimaryColumn({ type: 'bigint' })
  group_id: number;

  @PrimaryColumn({ type: 'bigint' })
  user_id: number;

  @Column({ nullable: true })
  card: string;

  @Column({ default: 'member' })
  role: string;

  @Column({ default: 100 })
  credit: number;

  @Column({ default: true })
  status: boolean;

  @CreateDateColumn()
  created_at: Date;

  @CreateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, user => user.id)
  user: User;

  @ManyToOne(() => GroupChat, group => group.id)
  group: GroupChat;
}