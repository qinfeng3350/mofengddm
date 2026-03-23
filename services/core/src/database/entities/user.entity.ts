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
import { TenantEntity } from './tenant.entity';
import { DepartmentEntity } from './department.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  account!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  email?: string;

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string; // 头像URL

  @Column({ type: 'varchar', length: 128, nullable: true })
  position?: string; // 职位

  @Column({ type: 'varchar', length: 64, nullable: true })
  jobNumber?: string; // 工号

  @ManyToOne(() => DepartmentEntity, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: DepartmentEntity;

  @Column({ name: 'department_id', type: 'bigint', nullable: true })
  departmentId?: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  status!: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
