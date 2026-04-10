import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('login_logs')
@Index(['tenantId', 'loginAt'])
export class LoginLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'bigint' })
  userId!: string;

  @Column({ name: 'user_name', type: 'varchar', length: 128, nullable: true })
  userName?: string | null;

  @Index()
  @CreateDateColumn({ name: 'login_at' })
  loginAt!: Date;

  @Column({ type: 'varchar', length: 255, default: '' })
  location!: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  platform!: string;

  @Column({ name: 'ip', type: 'varchar', length: 64, default: '' })
  ip!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;
}
