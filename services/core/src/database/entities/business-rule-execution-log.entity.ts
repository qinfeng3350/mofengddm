import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('business_rule_execution_logs')
@Index(['tenantId', 'applicationId', 'ruleId', 'formId', 'recordId'])
export class BusinessRuleExecutionLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Column({ name: 'application_id', type: 'bigint', nullable: true })
  applicationId!: string | null;

  @Index()
  @Column({ name: 'rule_id', type: 'varchar', length: 128 })
  ruleId!: string;

  @Column({ name: 'rule_name', type: 'varchar', length: 255, nullable: true })
  ruleName?: string;

  @Column({ name: 'form_id', type: 'varchar', length: 128 })
  formId!: string;

  @Column({ name: 'record_id', type: 'varchar', length: 128 })
  recordId!: string;

  @Column({ name: 'trigger_event', type: 'varchar', length: 32 })
  triggerEvent!: 'create' | 'update' | 'delete' | 'statusChange';

  @Column({ name: 'status', type: 'varchar', length: 32 })
  status!: 'success' | 'failed' | 'skipped';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs?: number | null;

  @Column({ name: 'payload_snapshot', type: 'json', nullable: true })
  payloadSnapshot?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

