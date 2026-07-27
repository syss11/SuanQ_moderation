import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './User.js';
import { GroupChat } from './GroupChat.js';

@Entity('human_verifications')
export class HumanVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  user_id: number;

  @Index()
  @Column()
  group_id: number;

  @Index()
  @Column()
  key: string;

  @Column({ default: 0 })
  retry_times: number;

  @Column({ nullable: true })
  answer?: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'passed' | 'failed';

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, user => user.id)
  user: User;

  @ManyToOne(() => GroupChat, group => group.id)
  group: GroupChat;
}