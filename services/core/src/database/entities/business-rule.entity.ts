import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApplicationEntity } from './application.entity';

@Entity('business_rules')
export class BusinessRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @ManyToOne(() => ApplicationEntity)
  @JoinColumn({ name: 'application_id' })
  application!: ApplicationEntity;

  @Index()
  @Column({ name: 'application_id', type: 'bigint' })
  applicationId!: string;

  @Index()
  @Column({ name: 'rule_id', type: 'varchar', length: 128, unique: true })
  ruleId!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 255 })
  ruleName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ type: 'json' })
  trigger!: {
    event: 'create' | 'update' | 'delete' | 'statusChange';
    formId: string;
    conditions?: Array<{
      fieldId: string;
      operator: string;
      value: any;
    }>;
  };

  @Column({ type: 'json' })
  actions!: Array<{
    type: string;
    targetFormId?: string;
    fieldMapping?: Record<string, string>;
    targetRecordId?: string;
    notification?: any;
    script?: string;
    api?: any;
  }>;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'varchar', length: 128, nullable: true })
  createdBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

