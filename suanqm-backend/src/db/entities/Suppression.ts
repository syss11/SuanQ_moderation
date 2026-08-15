import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('suppressions')
@Index(['user_id', 'group_id'], { unique: true })
export class Suppression {
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

  @Column({ type: 'bigint' })
  set_at: number;

  @Column({ type: 'bigint' })
  calculated_at: number;

  @Column({ type: 'float', default: 40 })
  energy: number;

  @Column({ type: 'float', default: 40 })
  max_energy: number;

  @Column({ type: 'float', default: 0 })
  regen_per_second: number;

  @Column({ type: 'int', default: 86400 })
  period: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
