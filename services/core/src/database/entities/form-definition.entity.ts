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

@Entity('form_definitions')
export class FormDefinitionEntity {
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
  @Column({ name: 'form_id', type: 'varchar', length: 128, unique: true })
  formId!: string;

  @Column({ name: 'form_name', type: 'varchar', length: 255 })
  formName!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  category?: string;

  @Column({ type: 'varchar', length: 64, default: 'draft' })
  status!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text' })
  config!: string | Record<string, unknown>;

  @Column({ name: 'layout', type: 'json', nullable: true })
  layout?: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'varchar', length: 128, nullable: true })
  createdBy?: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 128, nullable: true })
  updatedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
