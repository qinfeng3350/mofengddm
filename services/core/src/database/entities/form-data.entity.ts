import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('form_data')
export class FormDataEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Index()
  @Column({ name: 'form_id', type: 'varchar', length: 128 })
  formId!: string;

  @Column({ name: 'record_id', type: 'varchar', length: 128, unique: true })
  recordId!: string;

  @Column({ type: 'json' })
  data!: Record<string, unknown>;

  @Column({
    name: 'submitter_id',
    type: 'varchar',
    length: 128,
    nullable: true,
  })
  submitterId?: string;

  @Column({
    name: 'submitter_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  submitterName?: string;

  @Column({ type: 'varchar', length: 64, default: 'submitted' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
