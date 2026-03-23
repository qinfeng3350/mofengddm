import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('operation_logs')
@Index(['formId', 'recordId'])
@Index(['tenantId', 'formId'])
export class OperationLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Index()
  @Column({ name: 'form_id', type: 'varchar', length: 128 })
  formId!: string;

  @Index()
  @Column({ name: 'record_id', type: 'varchar', length: 128 })
  recordId!: string;

  @Column({ name: 'operation_type', type: 'varchar', length: 50 })
  operationType!: 'create' | 'update' | 'delete';

  @Column({ name: 'operator_id', type: 'varchar', length: 128 })
  operatorId!: string;

  @Column({ name: 'operator_name', type: 'varchar', length: 255, nullable: true })
  operatorName?: string;

  @Column({ type: 'json', nullable: true })
  fieldChanges?: Array<{
    fieldId: string;
    fieldLabel?: string;
    oldValue: any;
    newValue: any;
  }>;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

