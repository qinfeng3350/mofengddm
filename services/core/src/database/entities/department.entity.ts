import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from './tenant.entity';

@Entity('departments')
export class DepartmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  code?: string; // 钉钉部门ID映射：dingtalk_123456

  @ManyToOne(() => DepartmentEntity, (dept) => dept.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: DepartmentEntity;

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId?: string;

  @OneToMany(() => DepartmentEntity, (dept) => dept.parent)
  children?: DepartmentEntity[];

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

