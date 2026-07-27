import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('group_chats')
export class GroupChat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, type: 'bigint' })
  group_id: number;

  @Column({ nullable: true })
  name?: string;

  @Column({ default: 0 })
  member_count: number;

  @CreateDateColumn()
  created_at: Date;
}