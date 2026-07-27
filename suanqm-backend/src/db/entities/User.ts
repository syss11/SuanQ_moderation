import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, type: 'bigint' })
  qq_id: number;

  @Column()
  nickname: string;

  @CreateDateColumn()
  created_at: Date;
}