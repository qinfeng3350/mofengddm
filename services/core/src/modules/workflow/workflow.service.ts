import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowInstanceEntity, FormDefinitionEntity } from '../../database/entities';
import { BusinessRuleExecutorService } from '../business-rule/business-rule.executor';

type WorkflowNode = {
  nodeId: string;
  type: 'start' | 'end' | 'approval' | 'condition' | 'parallel' | 'task';
  label: string;
  assignees?: { type?: string; values?: string[] };
  config?: Record<string, unknown>;
};

type WorkflowEdge = {
  edgeId: string;
  source: string;
  target: string;
  config?: { label?: string };
};

@Injectable()
export class WorkflowService {
  constructor(
    @InjectRepository(WorkflowInstanceEntity)
    private readonly instanceRepo: Repository<WorkflowInstanceEntity>,
    @InjectRepository(FormDefinitionEntity)
    private readonly formRepo: Repository<FormDefinitionEntity>,
    @Inject(forwardRef(() => BusinessRuleExecutorService))
    private readonly ruleExecutor: BusinessRuleExecutorService,
  ) {}

  async start(params: { tenantId: string; formId: string; recordId: string; workflow: { nodes: WorkflowNode[]; edges: WorkflowEdge[]; workflowId?: string; workflowName?: string }; userId?: string; userName?: string }) {
    const { tenantId, formId, recordId, workflow, userId, userName } = params;
    const startNode = workflow.nodes.find(n => n.type === 'start');
    if (!startNode) throw new BadRequestException('流程未包含开始节点');

    const nextEdge = workflow.edges.find(e => e.source === startNode.nodeId) || workflow.edges.find(e => e.source === 'start');
    const nextNodeId = nextEdge?.target;

    const now = new Date();
    const instance = this.instanceRepo.create({
      tenantId,
      formId,
      recordId,
      workflowId: workflow.workflowId || `wf_${Date.now()}`,
      status: 'running',
      currentNodeId: nextNodeId || undefined,
      definition: { nodes: workflow.nodes, edges: workflow.edges },
      tasks: [],
      history: [
        {
          type: 'start',
          at: now.toISOString(),
          nodeId: startNode.nodeId,
          label: startNode.label,
          nodeType: startNode.type,
          userId,
          userName,
        },
      ],
    });

    // 创建首个任务（如果下一个节点是审批或抄送）
    const nextNode = workflow.nodes.find(n => n.nodeId === nextNodeId);
    if (nextNode && (nextNode.type === 'approval' || nextNode.type === 'task')) {
      (instance.tasks as any[]).push({
        taskId: `tk_${Date.now()}`,
        nodeId: nextNode.nodeId,
        nodeType: nextNode.type,
        label: nextNode.label,
        assignees: nextNode.assignees || {},
        status: 'pending',
        createdAt: now.toISOString(),
      });
    }

    const saved = await this.instanceRepo.save(instance);
    return { instanceId: saved.id, currentNodeId: saved.currentNodeId };
  }

  async getInstance(instanceId: string, tenantId: string) {
    const inst = await this.instanceRepo.findOne({ where: { id: instanceId, tenantId } });
    if (!inst) throw new NotFoundException('流程实例不存在');
    return inst;
  }

  async getInstanceByRecord(recordId: string, tenantId: string) {
    let inst = await this.instanceRepo.findOne({ where: { recordId, tenantId }, order: { id: 'DESC' } });
    if (!inst) {
      inst = await this.instanceRepo.findOne({ where: { recordId }, order: { id: 'DESC' } });
    }
    if (!inst) throw new NotFoundException('流程实例不存在');
    return inst;
  }

  async listTasks(tenantId: string, options?: { status?: 'pending' | 'completed'; userId?: string }) {
    const all = await this.instanceRepo.find({ where: { tenantId } });
    const tasks: any[] = [];
    all.forEach(inst => {
      (inst.tasks || []).forEach((t: any) => {
        if (options?.status && t.status !== options.status) return;
        // 如提供 userId，则仅返回指派给该用户的任务（assignees.values 包含 userId）
        if (options?.userId) {
          const assignees = t.assignees || {};
          const values: string[] = Array.isArray(assignees.values) ? assignees.values : [];
          if (values.length > 0 && !values.includes(String(options.userId))) {
            return;
          }
        }
        tasks.push({
          instanceId: inst.id,
          recordId: inst.recordId,
          formId: inst.formId,
          workflowId: inst.workflowId,
          taskId: t.taskId,
          nodeId: t.nodeId,
          nodeType: t.nodeType,
          label: t.label,
          assignees: t.assignees,
          status: t.status,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          currentNodeId: inst.currentNodeId,
          instanceStatus: inst.status,
        });
      });
    });
    // 按创建时间倒序
    tasks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return tasks;
  }

  async action(instanceId: string, tenantId: string, payload: { nodeId: string; action: 'approve' | 'reject' | 'return'; comment?: string; userId?: string; userName?: string }) {
    const inst = await this.getInstance(instanceId, tenantId);
    const def = inst.definition as any;
    const nodes: WorkflowNode[] = def.nodes || [];
    const edges: WorkflowEdge[] = def.edges || [];

    // 标记当前任务
    const task = (inst.tasks || []).find((t: any) => t.nodeId === payload.nodeId && t.status === 'pending');
    const now = new Date().toISOString();
    if (task) {
      (task as any).status = payload.action === 'approve' ? 'approved' : payload.action === 'return' ? 'returned' : 'rejected';
      (task as any).comment = payload.comment;
      (task as any).updatedAt = now;
      (task as any).actedBy = payload.userId;
      (task as any).actedByName = payload.userName;
    }

    const currentNode = nodes.find(n => n.nodeId === payload.nodeId);
    if (!currentNode) throw new BadRequestException('节点不存在');

    inst.history = inst.history || [];
    inst.history.push({
      type: payload.action,
      at: now,
      nodeId: currentNode.nodeId,
      label: currentNode.label,
      nodeType: currentNode.type,
      comment: payload.comment,
      userId: payload.userId,
      userName: payload.userName,
    });

    if (payload.action === 'reject' || payload.action === 'return') {
      inst.status = payload.action === 'reject' ? 'rejected' : 'running';
      inst.currentNodeId = undefined;
      return this.instanceRepo.save(inst);
    }

    // 计算下一个节点
    const edge = edges.find(e => e.source === currentNode.nodeId);
    const nextNodeId = edge?.target;
    const nextNode = nodes.find(n => n.nodeId === nextNodeId);

    if (!nextNodeId || !nextNode || nextNode.type === 'end') {
      // 无后续节点或直接流向结束节点，流程完成（补一条「结束」记录，便于前端展示完整链路）
      inst.status = 'completed';
      inst.currentNodeId = undefined;
      inst.history.push({
        type: 'end',
        at: now,
        nodeId: nextNode?.type === 'end' ? nextNode.nodeId : 'end',
        label: nextNode?.type === 'end' ? nextNode.label || '结束' : '结束',
        nodeType: 'end',
        userId: payload.userId,
        userName: payload.userName,
      });
      const savedInstance = await this.instanceRepo.save(inst);
      
      // 触发业务规则：流程状态变化事件
      try {
        await this.ruleExecutor.handleEvent('statusChange', {
          formId: inst.formId,
          tenantId: inst.tenantId,
          recordId: inst.recordId,
          data: {}, // 流程状态变化时，data 为空，可以通过 recordId 获取表单数据
          userId: payload.userId,
        });
      } catch (error) {
        console.error('触发流程状态变化业务规则失败:', error);
        // 不影响流程完成，只记录日志
      }
      
      return savedInstance;
    }

    inst.currentNodeId = nextNodeId;

    // 如果下一个节点是审批或抄送，创建待办
    if (nextNode.type === 'approval' || nextNode.type === 'task') {
      (inst.tasks as any[]).push({
        taskId: `tk_${Date.now()}`,
        nodeId: nextNode.nodeId,
        nodeType: nextNode.type,
        label: nextNode.label,
        assignees: nextNode.assignees || {},
        status: 'pending',
      });
    }

    return this.instanceRepo.save(inst);
  }
}
