import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { User } from './User.js';
import { GroupChat } from './GroupChat.js';

@Entity('human_verifications')
export class HumanVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Index()
  @Column({ type: 'bigint' })
  group_id: number;

  @Index()
  @Column()
  key: string; // 格式：时间戳-userId-question (question 即原题)

  @Column({ default: 0 })
  retry_times: number;

  @Column()
  expected_answer: string;

  @Column({ nullable: true })
  user_answer?: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'passed' | 'failed';

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, user => user.id)
  user: User;

  @ManyToOne(() => GroupChat, group => group.id)
  group: GroupChat;
}
