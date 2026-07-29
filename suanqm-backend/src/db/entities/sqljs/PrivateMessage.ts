import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('private_messages')
@Index(['user_id', 'time'])
@Index(['target_id', 'time'])
export class PrivateMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  self_id: number;

  @Column()
  user_id: number;

  @Column('bigint')
  time: number;

  @Column()
  message_id: number;

  @Column()
  message_seq: number;

  @Column()
  real_id: number;

  @Column()
  message_type: string;

  @Column({ type: 'simple-json' })
  sender: {
    user_id: number;
    nickname: string;
    card: string;
  };

  @Column({ type: 'text' })
  raw_message: string;

  @Column()
  font: number;

  @Column()
  sub_type: string;

  @Column({ type: 'simple-json' })
  message: any[];

  @Column()
  message_format: string;

  @Column()
  post_type: string;

  @Column()
  target_id: number;

  @Column({ default: 1 })
  status: number;

  @Column({ default: false })
  is_read: boolean;

  @CreateDateColumn()
  created_at: Date;
}