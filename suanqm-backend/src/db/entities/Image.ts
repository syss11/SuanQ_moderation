import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('images')
@Index(['message_id'])
@Index(['md5'], { unique: true })
export class Image {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  filename: string;

  @Column({ type: 'text' })
  path: string;

  @Column()
  size: number;

  @Column()
  message_id: number;

  @Column()
  image_url: string;

  @Column({ type: 'varchar', length: 32 })
  md5: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phash: string;

  @Column({ default: false })
  banned: boolean;

  @Column({ type: 'text', nullable: true })
  ban_reason: string | null;

  @CreateDateColumn()
  created_at: Date;
}