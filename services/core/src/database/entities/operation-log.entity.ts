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

  // 兼容历史建表为 TEXT 的字段：用 transformer 做 JSON 序列化/反序列化
  @Column({
    name: 'fieldChanges',
    type: 'text',
    nullable: true,
    transformer: {
      to: (v: any) => {
        if (v == null) return null;
        try {
          return typeof v === 'string' ? v : JSON.stringify(v);
        } catch {
          return null;
        }
      },
      from: (v: any) => {
        if (v == null) return undefined;
        if (Array.isArray(v)) return v;
        if (typeof v !== 'string') return v;
        try {
          const parsed = JSON.parse(v);
          return parsed;
        } catch {
          return undefined;
        }
      },
    },
  })
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

