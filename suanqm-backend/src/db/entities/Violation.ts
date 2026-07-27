import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum ViolationType {
  FLOOD_OR_NONSENSE = 'flood',
  ADVERTISING = 'advertising',
  POLITICAL_OR_RUMOR = 'political_or_rumor',
  VIOLENCE_OR_SEXUAL = 'violence_or_sexual',
  ILLEGAL_SOFTWARE = 'illegal_software',
  INSULT_OR_ATTACK = 'insult_or_attack',
  DOXXING_OR_THREATENING = 'doxxing_or_threatening',
  OTHER = 'other'
}

export enum PenaltyType {
  WARNING = 'warning',
  MUTE = 'mute',
  CREDIT_DEDUCTION = 'credit_deduction',
  OTHER = 'other'
}

export enum ViolationStatus {
  ACTIVE = 'active',
  DELETED = 'deleted',
  PENDING = 'pending'
}

@Entity('violations')
@Index(['user_id', 'created_at'])
@Index(['violation_type', 'created_at'])
export class Violation {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'bigint' })
  user_id: number;

  @Column('bigint')
  time: number;

  @Column({
    type: 'varchar',
    default: ViolationType.OTHER
  })
  violation_type: ViolationType;

  @Column({ nullable: true })
  severity: number;

  @Column({ default: 0 })
  credit_change: number;

  @Column({
    type: 'varchar',
    nullable: true
  })
  penalty_type: PenaltyType | null;

  @Column('bigint', { nullable: true })
  penalty_time: number | null;

  @Column({
    type: 'varchar',
    default: ViolationStatus.ACTIVE
  })
  status: ViolationStatus;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  created_at: Date;
}