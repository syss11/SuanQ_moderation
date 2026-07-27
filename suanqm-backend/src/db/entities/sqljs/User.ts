import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ unique: true })
  qq_id: number;

  @Column()
  nickname: string;

  @CreateDateColumn()
  created_at: Date;
}