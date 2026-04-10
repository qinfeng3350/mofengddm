import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('enterprise_logs')
@Index(['tenantId', 'category', 'createdAt'])
export class EnterpriseLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index()
  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Index()
  @Column({ name: 'category', type: 'varchar', length: 20 })
  category!: 'platform' | 'app' | 'message';

  @Column({ name: 'subtype', type: 'varchar', length: 64, nullable: true })
  subtype?: string | null;

  @Column({ name: 'operator_id', type: 'varchar', length: 128, nullable: true })
  operatorId?: string | null;

  @Column({ name: 'operator_name', type: 'varchar', length: 128, nullable: true })
  operatorName?: string | null;

  @Column({ name: 'receiver', type: 'varchar', length: 128, nullable: true })
  receiver?: string | null;

  @Column({ name: 'operation_type', type: 'varchar', length: 128, nullable: true })
  operationType?: string | null;

  @Column({ name: 'trigger_type', type: 'varchar', length: 128, nullable: true })
  triggerType?: string | null;

  @Column({ name: 'error_type', type: 'varchar', length: 128, nullable: true })
  errorType?: string | null;

  @Column({ name: 'related_app', type: 'varchar', length: 128, nullable: true })
  relatedApp?: string | null;

  @Column({ name: 'related_object', type: 'varchar', length: 128, nullable: true })
  relatedObject?: string | null;

  @Column({ name: 'content', type: 'varchar', length: 255, nullable: true })
  content?: string | null;

  @Column({ name: 'detail', type: 'text', nullable: true })
  detail?: string | null;

  @Column({ name: 'ip', type: 'varchar', length: 64, default: '' })
  ip!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

