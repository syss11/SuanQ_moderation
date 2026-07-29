import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('group_chats')
export class GroupChat {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ unique: true })
  group_id: number;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ default: 0 })
  member_count: number;

  @CreateDateColumn()
  created_at: Date;
}