import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('record_comments')
@Index(['tenantId', 'formId', 'recordId'])
export class RecordCommentEntity {
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

  @Column({ name: 'operator_id', type: 'varchar', length: 128 })
  operatorId!: string;

  @Column({ name: 'operator_name', type: 'varchar', length: 255, nullable: true })
  operatorName?: string;

  @Column({ name: 'operator_avatar', type: 'varchar', length: 1024, nullable: true })
  operatorAvatar?: string;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

