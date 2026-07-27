import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('command_logs')
export class CommandLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Index()
  @Column({ type: 'bigint', nullable: true })
  group_id: number | null;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  command: string;

  @Column({ type: 'text', nullable: true })
  params: string | null;

  @Column({ type: 'boolean', default: false })
  is_co_admin: boolean;

  @Column({ type: 'int', nullable: true })
  ruling_cost: number | null;

  @Column({ type: 'bigint', nullable: true })
  target_user_id: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  auth_level: string | null;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}