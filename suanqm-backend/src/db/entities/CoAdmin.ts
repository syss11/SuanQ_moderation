import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('co_admins')
@Index(['user_id', 'group_id'], { unique: true })
export class CoAdmin {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Index()
  @Column({ type: 'bigint' })
  group_id: number;

  @Column({ default: true })
  status: boolean;

  @Column({ default: 50 })
  max_ruling: number;

  @Column({ default: 50 })
  ruling: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}