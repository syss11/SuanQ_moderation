import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_interactions')
@Index(['user_id', 'group_id'], { unique: true })
export class UserInteraction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Index()
  @Column({ type: 'bigint' })
  group_id: number;

  @Column({ default: 1 })
  remaining_checkins: number;

  @Column({ type: 'text', nullable: true })
  last_checkin_date: string | null;

  @Column({ default: 3 })
  remaining_interactions: number;

  @Column({ type: 'text', nullable: true })
  last_interaction_date: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}