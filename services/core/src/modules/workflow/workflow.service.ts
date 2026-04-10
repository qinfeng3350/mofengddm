import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WorkflowInstanceEntity,
  FormDefinitionEntity,
  FormDataEntity,
  TenantEntity,
  UserEntity,
} from '../../database/entities';
import { BusinessRuleExecutorService } from '../business-rule/business-rule.executor';
import { DingtalkService } from '../dingtalk/dingtalk.service';
import { EnterpriseLogService } from '../enterprise-log/enterprise-log.service';

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
    @InjectRepository(FormDataEntity)
    private readonly formDataRepo: Repository<FormDataEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Inject(forwardRef(() => BusinessRuleExecutorService))
    private readonly ruleExecutor: BusinessRuleExecutorService,
    private readonly dingtalkService: DingtalkService,
    private readonly configService: ConfigService,
    private readonly enterpriseLogService: EnterpriseLogService,
  ) {}

  private async pushDingtalkTodoIfNeeded(params: {
    tenantId: string;
    taskId: string;
    nodeLabel: string;
    recordId: string;
    assigneeUserIds: string[];
    creatorUserId?: string; // 流程发起/操作用户（系统用户id）
  }): Promise<
    | {
        todoTaskId: string;
        creatorUnionId: string;
        executorUnionIds: string[];
      }
    | null
  > {
    const tenant = await this.tenantRepository.findOne({
      where: { id: params.tenantId },
    });

    if (!tenant) return null;

    const rawMeta = tenant.metadata as any;
    // tenants.metadata 在 DB 层是 TEXT，TypeORM 有时会返回字符串，需要兜底 parse
    const meta: any =
      typeof rawMeta === 'string'
        ? (() => {
            try {
              return JSON.parse(rawMeta);
            } catch {
              return {};
            }
          })()
        : rawMeta || {};

    const ding = meta?.dingtalk;

    if (!ding?.appKey || !ding?.appSecret || !ding?.agentId) {
      // 未配置钉钉待办推送
      console.warn('[WorkflowService] 跳过钉钉待办推送：tenant 未配置 dingtalk 信息', {
        tenantId: params.tenantId,
        tenantCode: (tenant as any).code,
        tenantName: (tenant as any).name,
        metadataType: typeof rawMeta,
        metadataHasDingtalkKey: !!(meta && typeof meta === 'object' && (meta as any).dingtalk),
        hasAppKey: !!ding?.appKey,
        hasAppSecret: !!ding?.appSecret,
        hasAgentId: !!ding?.agentId,
        dingRaw: ding ?? null,
      });
      return null;
    }

    if (!params.assigneeUserIds?.length) {
      console.warn('[WorkflowService] 跳过钉钉待办推送：当前节点没有 assignees', {
        tenantId: params.tenantId,
        nodeLabel: params.nodeLabel,
        taskId: params.taskId,
        recordId: params.recordId,
      });
      return null;
    }

    const dingtalkAgentId = String(ding.agentId);

    // 1) 解析 creatorUnionId（流程发起/操作用户的 dingtalkUserId）
    let creatorUnionId: string | undefined = undefined;
    const parseUserMetadata = (value: unknown): Record<string, unknown> => {
      if (!value) return {};
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return {};
        }
      }
      if (typeof value === 'object') return value as Record<string, unknown>;
      return {};
    };
    if (params.creatorUserId) {
      const creatorUser = await this.userRepository.findOne({
        where: { id: params.creatorUserId },
      });
      creatorUnionId =
        (parseUserMetadata(creatorUser?.metadata)?.dingtalkUnionId as any) ||
        (parseUserMetadata(creatorUser?.metadata)?.dingtalkUserId as any);
    }

    // 2) 解析 executorUnionIds（所有 assignee 的 dingtalkUserId）
    const executorUnionIds: string[] = [];
    for (const assigneeUserId of params.assigneeUserIds) {
      const systemUser = await this.userRepository.findOne({
        where: { id: assigneeUserId },
      });

      if (!systemUser) {
        console.warn('[WorkflowService] 找不到系统用户，无法推送钉钉待办', {
          tenantId: params.tenantId,
          assigneeUserId,
        });
        continue;
      }

      const dingtalkUnionId =
        (parseUserMetadata(systemUser?.metadata)?.dingtalkUnionId as any) ||
        (parseUserMetadata(systemUser?.metadata)?.dingtalkUserId as any);
      if (!dingtalkUnionId) {
        console.warn('[WorkflowService] 系统用户缺少 dingtalkUserId，无法推送钉钉待办', {
          tenantId: params.tenantId,
          assigneeUserId,
        });
        continue;
      }

      executorUnionIds.push(String(dingtalkUnionId));
    }

    // 若 creatorUnionId 没有拿到，兜底用第一个 executor（避免完全不推）
    if (!creatorUnionId) creatorUnionId = executorUnionIds[0];

    if (!creatorUnionId || executorUnionIds.length === 0) {
      console.warn('[WorkflowService] 跳过钉钉待办推送：缺少 creator/executor unionId', {
        tenantId: params.tenantId,
        creatorUserId: params.creatorUserId,
        creatorUnionId,
        executorUnionCount: executorUnionIds.length,
      });
      return null;
    }

    try {
      console.log('[WorkflowService] 推送钉钉待办 v1.0 todo', {
        tenantId: params.tenantId,
        creatorUnionId,
        executorUnionIds,
        agentId: dingtalkAgentId,
        nodeLabel: params.nodeLabel,
        recordId: params.recordId,
        sourceIdentifier: `wf_${params.tenantId}_${params.taskId}`,
      });

      // 部署后 DingTalk 必须能通过公网域名访问 detailUrl（生产勿用 localhost）
      const portalBaseUrl =
        (this.configService.get<string>('portal.baseUrl') || '').trim() ||
        process.env.PORTAL_BASE_URL ||
        process.env.PORTAL_PUBLIC_BASE_URL ||
        process.env.PUBLIC_PORTAL_URL;

      if (!portalBaseUrl) {
        console.warn(
          '[WorkflowService] 跳过钉钉待办：未配置 PORTAL_BASE_URL（待办详情链接无法生成）。' +
            '请在 services/core/.env 中设置 PORTAL_BASE_URL 为公网可访问的前端地址，例如 https://ddm.xxx.com',
        );
        return null;
      }

      // DingTalk 待办链接必须指向“前端真实存在的记录列表入口”
      // 当前前端路由为：/app/:appId（RuntimeListPage）
      // 需要通过 workflow_instance.recordId -> formId -> form_definition.application_id 解析出 appId
      let appId: string | null = null;
      try {
        const inst = await this.instanceRepo.findOne({
          where: { tenantId: params.tenantId, recordId: params.recordId },
        });
        if (inst?.formId) {
          const formDef = await this.formRepo.findOne({
            where: { tenantId: params.tenantId, formId: inst.formId },
          });
          appId = formDef?.applicationId ? String(formDef.applicationId) : null;
        }
      } catch (e) {
        // 解析失败不影响主流程，fallback 到原来的 runtime/list（但可能 404）
        console.warn('[WorkflowService] 解析 appId 失败，使用 fallback runtime/list', {
          tenantId: params.tenantId,
          recordId: params.recordId,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      const detailUrl = appId
        ? `${portalBaseUrl}/app/${encodeURIComponent(appId)}?recordId=${encodeURIComponent(
            params.recordId,
          )}`
        : `${portalBaseUrl}/runtime/list?recordId=${encodeURIComponent(
            params.recordId,
          )}`;

      const created = await this.dingtalkService.addToDoTask({
        appKey: String(ding.appKey),
        appSecret: String(ding.appSecret),
        creatorUnionId,
        executorUnionIds,
        title: `待办：${params.nodeLabel}`,
        description: `流程记录：${params.recordId}`,
        sourceIdentifier: `wf_${params.tenantId}_${params.taskId}`,
        sourceUrl: detailUrl,
      });

      if (created?.id) {
        await this.enterpriseLogService.log({
          tenantId: params.tenantId,
          category: 'message',
          subtype: 'message',
          operatorId: params.creatorUserId,
          operationType: '发送消息',
          triggerType: '钉钉待办',
          relatedObject: params.recordId,
          content: `待办：${params.nodeLabel}`,
          detail: `推送成功 taskId=${created.id}`,
          ip: '127.0.0.1',
        });
        return {
          todoTaskId: String(created.id),
          creatorUnionId,
          executorUnionIds,
        };
      }
      return null;
    } catch (e) {
      const err: any = e;
      console.error(
        '[WorkflowService] 推送钉钉待办失败',
        {
          tenantId: params.tenantId,
          taskId: params.taskId,
          creatorUserId: params.creatorUserId,
          creatorUnionId,
          executorUnionIds,
          status: err?.response?.status,
          data: err?.response?.data,
        },
        err?.message || e,
      );
      await this.enterpriseLogService.log({
        tenantId: params.tenantId,
        category: 'message',
        subtype: 'message',
        operatorId: params.creatorUserId,
        operationType: '发送消息',
        triggerType: '钉钉待办',
        errorType: '发送失败',
        relatedObject: params.recordId,
        content: `待办：${params.nodeLabel}`,
        detail: err?.message || '钉钉待办推送失败',
        ip: '127.0.0.1',
      });
      return null;
    }
  }

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

    // 创建待办推送到钉钉（如果该流程第一个节点需要指派）
    if (nextNode && (nextNode.type === 'approval' || nextNode.type === 'task')) {
      const firstTask = (instance.tasks as any[])[0];
      const assignees = nextNode.assignees || {};
      const values: string[] = Array.isArray(assignees.values) ? assignees.values : [];
      if (firstTask?.taskId) {
        const dt = await this.pushDingtalkTodoIfNeeded({
          tenantId,
          taskId: String(firstTask.taskId),
          nodeLabel: nextNode.label,
          recordId: String(recordId),
          assigneeUserIds: values.map(String),
          creatorUserId: userId ? String(userId) : undefined,
        });

        if (dt?.todoTaskId) {
          (firstTask as any).dingtalkTodo = {
            taskId: dt.todoTaskId,
            creatorUnionId: dt.creatorUnionId,
            executorUnionIds: dt.executorUnionIds,
          };
          await this.instanceRepo.save(instance);
        }
      }
    }
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

    if (payload.action === 'reject') {
      inst.status = 'rejected';
      inst.currentNodeId = undefined;
      return this.instanceRepo.save(inst);
    }

    /** 退回：回到上一节点，并为上一节点生成待办（发起节点指派给发起人，可改单后再次「同意」提交） */
    if (payload.action === 'return') {
      const incomingEdge = edges.find(
        e =>
          e.target === currentNode.nodeId ||
          (e as WorkflowEdge & { targetId?: string }).targetId === currentNode.nodeId,
      );
      if (!incomingEdge) {
        throw new BadRequestException('无法退回：已是第一个节点或未找到上一节点连线');
      }
      const prevNodeId =
        incomingEdge.source ||
        (incomingEdge as WorkflowEdge & { sourceId?: string }).sourceId;
      const prevNode = nodes.find(
        n => n.nodeId === prevNodeId || (n as WorkflowNode & { id?: string }).id === prevNodeId,
      );
      if (!prevNode) {
        throw new BadRequestException('无法退回：上一节点不存在');
      }

      inst.status = 'running';
      inst.currentNodeId = prevNode.nodeId;

      const startHist = (inst.history || []).find((h: any) => h.type === 'start');
      let initiatorId: string | undefined = startHist?.userId ? String(startHist.userId) : undefined;
      if (!initiatorId && inst.recordId) {
        const fd = await this.formDataRepo.findOne({ where: { recordId: inst.recordId } });
        if (fd?.submitterId) initiatorId = String(fd.submitterId);
      }

      let assignees: { type?: string; values?: string[] } = {
        ...(prevNode.assignees || {}),
        values: [...(prevNode.assignees?.values || []).map(String)],
      };
      if (prevNode.type === 'start') {
        if (!initiatorId) {
          throw new BadRequestException('无法退回至发起节点：缺少发起人信息');
        }
        assignees = { values: [initiatorId] };
      }

      const newTaskId = `tk_${Date.now()}`;
      (inst.tasks as any[]).push({
        taskId: newTaskId,
        nodeId: prevNode.nodeId,
        nodeType: prevNode.type,
        label: prevNode.label,
        assignees,
        status: 'pending',
        createdAt: now,
      });

      let saved = await this.instanceRepo.save(inst);

      const createdTask = (inst.tasks as any[]).find((t: any) => t.taskId === newTaskId);
      const assigneeIds: string[] = Array.isArray(assignees.values) ? assignees.values.map(String) : [];
      if (
        createdTask?.taskId &&
        assigneeIds.length &&
        (prevNode.type === 'approval' || prevNode.type === 'task' || prevNode.type === 'start')
      ) {
        const dt = await this.pushDingtalkTodoIfNeeded({
          tenantId,
          taskId: String(createdTask.taskId),
          nodeLabel: prevNode.label || '待处理',
          recordId: String(inst.recordId),
          assigneeUserIds: assigneeIds,
          creatorUserId: payload.userId ? String(payload.userId) : undefined,
        });
        if (dt?.todoTaskId) {
          (createdTask as any).dingtalkTodo = {
            taskId: dt.todoTaskId,
            creatorUnionId: dt.creatorUnionId,
            executorUnionIds: dt.executorUnionIds,
          };
          saved = await this.instanceRepo.save(inst);
        }
      }

      return saved;
    }

    // 当前节点“同意”后：如存在钉钉待办，更新执行者状态为完成（使钉钉待办自动移除/完成）
    if (payload.action === 'approve' && task && (task as any).dingtalkTodo?.taskId) {
      try {
        const tenantEntity = await this.tenantRepository.findOne({ where: { id: tenantId } });
        const rawMeta = (tenantEntity as any)?.metadata;
        const meta: any =
          typeof rawMeta === 'string'
            ? (() => {
                try {
                  return JSON.parse(rawMeta);
                } catch {
                  return {};
                }
              })()
            : rawMeta || {};
        const ding = meta?.dingtalk;

        const parseUserMetadata = (value: unknown): Record<string, unknown> => {
          if (!value) return {};
          if (typeof value === 'string') {
            try {
              return JSON.parse(value);
            } catch {
              return {};
            }
          }
          if (typeof value === 'object') return value as Record<string, unknown>;
          return {};
        };

        let operatorUnionIdValue: string | undefined = undefined;
        if (payload.userId) {
          const operatorUser = await this.userRepository.findOne({
            where: { id: String(payload.userId) },
          });
          const om = parseUserMetadata(operatorUser?.metadata);
          operatorUnionIdValue = (om as any)?.dingtalkUnionId || (om as any)?.dingtalkUserId;
        }

        if (ding?.appKey && ding?.appSecret) {
          const dt = (task as any).dingtalkTodo;
          await this.dingtalkService.updateTodoExecutorStatus({
            appKey: String(ding.appKey),
            appSecret: String(ding.appSecret),
            unionId: String(dt.creatorUnionId),
            taskId: String(dt.taskId),
            executorUnionIds: Array.isArray(dt.executorUnionIds) ? dt.executorUnionIds.map(String) : [],
            isDone: true,
            operatorUnionId: operatorUnionIdValue ? String(operatorUnionIdValue) : undefined,
          });
        }
      } catch (e) {
        console.warn('[WorkflowService] 更新钉钉待办完成状态失败', (e as any)?.message || e);
      }
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

    const saved = await this.instanceRepo.save(inst);

    // 推送待办到钉钉
    if (nextNode.type === 'approval' || nextNode.type === 'task') {
      const createdTask = (inst.tasks as any[]).find((t: any) => t.nodeId === nextNode.nodeId && t.status === 'pending');
      const assignees = nextNode.assignees || {};
      const values: string[] = Array.isArray(assignees.values) ? assignees.values : [];
      if (createdTask?.taskId) {
        const dt = await this.pushDingtalkTodoIfNeeded({
          tenantId,
          taskId: String(createdTask.taskId),
          nodeLabel: nextNode.label,
          recordId: String(inst.recordId),
          assigneeUserIds: values.map(String),
          creatorUserId: payload.userId ? String(payload.userId) : undefined,
        });

        if (dt?.todoTaskId) {
          (createdTask as any).dingtalkTodo = {
            taskId: dt.todoTaskId,
            creatorUnionId: dt.creatorUnionId,
            executorUnionIds: dt.executorUnionIds,
          };
          await this.instanceRepo.save(inst);
        }
      }
    }

    return saved;
  }
}
