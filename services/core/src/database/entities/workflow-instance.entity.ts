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
import { FormDefinitionEntity } from './form-definition.entity';

@Entity('workflow_instances')
export class WorkflowInstanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @ManyToOne(() => FormDefinitionEntity)
  @JoinColumn({ name: 'form_id', referencedColumnName: 'formId' })
  formDefinition!: FormDefinitionEntity;

  @Index()
  @Column({ name: 'form_id', type: 'varchar', length: 128 })
  formId!: string;

  @Index()
  @Column({ name: 'record_id', type: 'varchar', length: 128 })
  recordId!: string;

  @Column({ name: 'workflow_id', type: 'varchar', length: 128 })
  workflowId!: string;

  @Column({ type: 'varchar', length: 32, default: 'running' })
  status!: 'running' | 'completed' | 'rejected';

  @Column({ name: 'current_node_id', type: 'varchar', length: 128, nullable: true })
  currentNodeId?: string;

  // 流程定义快照（nodes/edges）
  @Column({ name: 'definition', type: 'json' })
  definition!: Record<string, unknown>;

  // 简化任务列表（便于演示），包含待办/已办
  @Column({ name: 'tasks', type: 'json', nullable: true })
  tasks?: Array<Record<string, unknown>>;

  // 历史流转记录（动作、时间、人员、节点）
  @Column({ name: 'history', type: 'json', nullable: true })
  history?: Array<Record<string, unknown>>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
