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
  UserRoleEntity,
  RoleEntity,
  DepartmentEntity,
} from '../../database/entities';
import { BusinessRuleExecutorService } from '../business-rule/business-rule.executor';
import { DingtalkService } from '../dingtalk/dingtalk.service';
import { EnterpriseLogService } from '../enterprise-log/enterprise-log.service';

type WorkflowNode = {
  nodeId: string;
  type: 'start' | 'end' | 'approval' | 'condition' | 'parallel' | 'task' | 'handler' | 'merge' | 'subprocess';
  label: string;
  assignees?: { type?: string; values?: string[]; formFieldId?: string };
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
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepository: Repository<UserRoleEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departmentRepository: Repository<DepartmentEntity>,
    @Inject(forwardRef(() => BusinessRuleExecutorService))
    private readonly ruleExecutor: BusinessRuleExecutorService,
    private readonly dingtalkService: DingtalkService,
    private readonly configService: ConfigService,
    private readonly enterpriseLogService: EnterpriseLogService,
  ) {}

  private parseJsonObject(input: unknown): Record<string, any> {
    if (!input) return {};
    if (typeof input === 'string') {
      try {
        return JSON.parse(input);
      } catch {
        return {};
      }
    }
    if (typeof input === 'object') return input as Record<string, any>;
    return {};
  }

  /** 钉钉 userid → 本系统 users.id（账号 dingtalk_{userid} 或 metadata.dingtalkUserId） */
  private async resolveDingtalkUserIdToSystemUserId(
    tenantId: string,
    dingtalkUserId: string,
  ): Promise<string | null> {
    const dt = String(dingtalkUserId || '').trim();
    if (!dt) return null;
    const byAccount = await this.userRepository.findOne({
      where: { tenantId, account: `dingtalk_${dt}`, status: 1 } as any,
    });
    if (byAccount?.id) return String(byAccount.id);
    const byMeta = await this.userRepository
      .createQueryBuilder('u')
      .where('u.tenantId = :tenantId', { tenantId })
      .andWhere('u.status = :status', { status: 1 })
      .andWhere(`JSON_UNQUOTE(JSON_EXTRACT(u.metadata, '$.dingtalkUserId')) = :dt`, { dt })
      .getMany();
    if (byMeta.length >= 1 && byMeta[0].id) return String(byMeta[0].id);
    return null;
  }

  /**
   * 「发起人直属上级」：优先 hand-written metadata，其次钉钉同步的 dingtalkManagerUserId，
   * 再尝试部门 metadata / 同部门标记为负责人的用户。不再回退为发起人本人（避免「领导是自己」）。
   */
  private async resolveInitiatorLeaderUserIds(
    tenantId: string,
    submitterId: string,
    preferredDeptId?: string,
  ): Promise<string[]> {
    const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
    if (!submitterId) return [];
    const initiator = await this.userRepository.findOne({
      where: { id: submitterId, tenantId } as any,
    });
    if (!initiator) return [];

    const um = this.parseJsonObject(initiator.metadata);
    const directLeaderId = um?.leaderUserId || um?.managerUserId || um?.managerId || um?.parentUserId;
    if (directLeaderId) {
      const leaderId = String(directLeaderId);
      if (leaderId && leaderId !== String(submitterId)) return uniq([leaderId]);
    }

    const dtMgr = um?.dingtalkManagerUserId ? String(um.dingtalkManagerUserId) : '';
    if (dtMgr) {
      const resolved = await this.resolveDingtalkUserIdToSystemUserId(tenantId, dtMgr);
      if (resolved && resolved !== String(submitterId)) return uniq([resolved]);
    }

    const deptId = preferredDeptId
      ? String(preferredDeptId)
      : initiator.departmentId
        ? String(initiator.departmentId)
        : '';
    if (deptId) {
      const dept = await this.departmentRepository.findOne({
        where: { id: deptId, tenantId } as any,
      });
      const dm = this.parseJsonObject(dept?.metadata);
      const deptLeaderSys = dm?.leaderUserId || dm?.deptLeaderUserId;
      if (deptLeaderSys) {
        const leaderId = String(deptLeaderSys);
        if (leaderId && leaderId !== String(submitterId)) return uniq([leaderId]);
      }

      const peers = await this.userRepository.find({
        where: { tenantId, departmentId: deptId, status: 1 } as any,
        select: ['id', 'metadata'] as any,
      });
      const leaderByDeptFlag = peers.find((u) => {
        if (String(u.id) === String(submitterId)) return false;
        const m = this.parseJsonObject(u.metadata);
        const li = Array.isArray(m?.dingtalkLeaderInDept) ? m.dingtalkLeaderInDept : [];
        const target = String(preferredDeptId || deptId);
        return li.some((x: any) => {
          if (x?.leader !== true) return false;
          return String(x?.deptSystemId || '') === target || String(x?.deptId || '') === target;
        });
      });
      if (leaderByDeptFlag?.id) return uniq([String(leaderByDeptFlag.id)]);
      const leader = peers.find(u => {
        if (String(u.id) === String(submitterId)) return false;
        const m = this.parseJsonObject(u.metadata);
        return m?.isLeader === true || m?.isAdmin === true || m?.isBoss === true;
      });
      if (leader?.id) return uniq([String(leader.id)]);
    }

    console.warn(
      '[WorkflowService] initiatorLeader 无法解析到上级用户（请钉钉同步写入 dingtalkManagerUserId，或在用户 metadata 配置 leaderUserId）',
      { tenantId, submitterId },
    );
    return [];
  }

  private async resolveAssignedUserIds(params: {
    tenantId: string;
    recordId?: string;
    assignees?: { type?: string; values?: string[]; formFieldId?: string };
    fallbackUserId?: string;
    submitterIdOverride?: string;
    draftData?: Record<string, any>;
    initiatorDeptId?: string;
  }): Promise<string[]> {
    const {
      tenantId,
      recordId,
      assignees,
      fallbackUserId,
      submitterIdOverride,
      draftData,
      initiatorDeptId,
    } = params;
    const type = String(assignees?.type || '');
    const values = Array.isArray(assignees?.values) ? assignees!.values.map(String) : [];
    const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

    const formData = recordId
      ? await this.formDataRepo.findOne({ where: { tenantId, recordId } })
      : null;
    const formValues = (draftData || formData?.data || {}) as Record<string, any>;
    const submitterId =
      submitterIdOverride
        ? String(submitterIdOverride)
        : formData?.submitterId
          ? String(formData.submitterId)
          : fallbackUserId
            ? String(fallbackUserId)
            : '';

    if (type === 'initiator') {
      return uniq([submitterId]);
    }

    if (type === 'initiatorLeader') {
      return this.resolveInitiatorLeaderUserIds(tenantId, submitterId, initiatorDeptId);
    }

    if (type === 'user') {
      return uniq(values);
    }

    if (type === 'role') {
      if (!values.length) return [];
      const roles = await this.roleRepository.find({ where: { tenantId } as any, select: ['id'] as any });
      const roleIdSet = new Set(roles.map((r) => String(r.id)));
      const roleIds = values.map(String).filter((id) => roleIdSet.has(id));
      if (!roleIds.length) return [];
      const urs = await this.userRoleRepository
        .createQueryBuilder('ur')
        .select(['ur.userId as userId'])
        .where('ur.roleId IN (:...roleIds)', { roleIds })
        .getRawMany();
      return uniq(urs.map((x: any) => String(x.userId)));
    }

    if (type === 'department') {
      if (!values.length) return [];
      const depts = await this.departmentRepository.find({ where: { tenantId } as any, select: ['id'] as any });
      const deptIdSet = new Set(depts.map((d) => String(d.id)));
      const deptIds = values.map(String).filter((id) => deptIdSet.has(id));
      if (!deptIds.length) return [];
      const users = await this.userRepository
        .createQueryBuilder('u')
        .select(['u.id as id'])
        .where('u.tenantId = :tenantId', { tenantId })
        .andWhere('u.status = :status', { status: 1 })
        .andWhere('u.departmentId IN (:...deptIds)', { deptIds })
        .getRawMany();
      return uniq(users.map((u: any) => String(u.id)));
    }

    if (type === 'formField') {
      const fieldId = assignees?.formFieldId ? String(assignees.formFieldId) : '';
      if (!fieldId) return [];
      if (fieldId === '__initiator__') {
        return uniq([submitterId]);
      }
      if (fieldId === '__dept_leader__') {
        return this.resolveInitiatorLeaderUserIds(tenantId, submitterId, initiatorDeptId);
      }
      if (fieldId === '__owner__') {
        const ownerId = formValues?.ownerId || submitterId;
        return uniq([String(ownerId || '')]);
      }
      if (fieldId === '__owner_dept__') {
        const deptId = String(formValues?.ownerDeptId || initiatorDeptId || '');
        if (!deptId) return [];
        const users = await this.userRepository
          .createQueryBuilder('u')
          .select(['u.id as id'])
          .where('u.tenantId = :tenantId', { tenantId })
          .andWhere('u.status = :status', { status: 1 })
          .andWhere('u.departmentId = :deptId', { deptId })
          .getRawMany();
        return uniq(users.map((u: any) => String(u.id)));
      }
      const raw = formValues[fieldId];
      if (Array.isArray(raw)) {
        return uniq(
          raw.map((v: any) =>
            typeof v === 'object' && v
              ? String(v.id ?? v.userId ?? v.value ?? '')
              : String(v ?? ''),
          ),
        );
      }
      if (raw && typeof raw === 'object') {
        return uniq([String(raw.id ?? raw.userId ?? raw.value ?? '')]);
      }
      return uniq([String(raw ?? '')]);
    }

    return uniq(values);
  }

  private collectInitiatorDeptIds(user: UserEntity): string[] {
    const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
    const out: string[] = [];
    if (user.departmentId) out.push(String(user.departmentId));
    const m = this.parseJsonObject(user.metadata);
    const pushAny = (v: any) => {
      if (Array.isArray(v)) {
        v.forEach((x) => {
          const s = String(x ?? '').trim();
          if (s) out.push(s);
        });
        return;
      }
      if (v != null && String(v).trim()) out.push(String(v).trim());
    };
    pushAny(m?.departmentIds);
    pushAny(m?.deptIds);
    pushAny(m?.dingtalkDeptIds);
    pushAny(m?.dingtalkDeptId);
    return uniq(out);
  }

  private async getInitiatorDeptOptions(
    tenantId: string,
    userId: string,
  ): Promise<{
    options: Array<{ id: string; name: string }>;
    primaryDeptId?: string;
  }> {
    const initiator = await this.userRepository.findOne({
      where: { tenantId, id: userId } as any,
      select: ['id', 'departmentId', 'metadata'] as any,
    });
    if (!initiator) return { options: [] };
    const ids = this.collectInitiatorDeptIds(initiator);
    if (!ids.length) return { options: [] };
    const primaryDeptId = initiator.departmentId
      ? String(initiator.departmentId)
      : undefined;
    const byIdRows = await this.departmentRepository.find({
      where: { tenantId } as any,
      select: ['id', 'name', 'code', 'parentId'] as any,
    });
    const byId = new Map<string, { id: string; name: string }>();
    const byCode = new Map<string, { id: string; name: string }>();
    const parentById = new Map<string, string | undefined>();
    byIdRows.forEach((d) => {
      byId.set(String(d.id), { id: String(d.id), name: String(d.name || d.id) });
      if ((d as any).code) byCode.set(String((d as any).code), { id: String(d.id), name: String(d.name || d.id) });
      parentById.set(String(d.id), (d as any).parentId ? String((d as any).parentId) : undefined);
    });
    const deptTargets: string[] = [];
    ids.forEach((raw) => {
      if (byId.has(raw)) {
        deptTargets.push(raw);
        return;
      }
      const maybeCode = raw.startsWith('dingtalk_') ? raw : `dingtalk_${raw}`;
      if (byCode.has(maybeCode)) deptTargets.push(String(byCode.get(maybeCode)!.id));
    });

    // 将每个候选部门的祖先链（公司主体 -> 子部门）展开，保证顶层主体在最上方。
    const orderedIds: string[] = [];
    const pushOrdered = (deptId: string) => {
      if (!deptId || orderedIds.includes(deptId)) return;
      orderedIds.push(deptId);
    };
    deptTargets.forEach((leafId) => {
      const chain: string[] = [];
      let cur: string | undefined = leafId;
      let guard = 0;
      while (cur && guard++ < 50) {
        chain.unshift(cur);
        cur = parentById.get(cur);
      }
      chain.forEach(pushOrdered);
    });

    const options = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean) as Array<{ id: string; name: string }>;

    return { options, primaryDeptId };
  }

  async previewAssignees(params: {
    tenantId: string;
    workflow: { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] };
    data?: Record<string, any>;
    initiatorUserId?: string;
    initiatorDeptId?: string;
  }) {
    const { tenantId, workflow, data, initiatorUserId, initiatorDeptId } = params;
    const nodes = (workflow?.nodes || []) as WorkflowNode[];
    const edges = (workflow?.edges || []) as WorkflowEdge[];
    const start = nodes.find((n) => n.type === 'start');
    const ordered: WorkflowNode[] = [];
    const seen = new Set<string>();
    let cur: WorkflowNode | undefined = start || nodes[0];
    let guard = 0;
    while (cur && !seen.has(cur.nodeId) && guard++ < 100) {
      ordered.push(cur);
      seen.add(cur.nodeId);
      const e = edges.find((x) => x.source === cur!.nodeId);
      const nextId = e?.target;
      cur = nextId ? nodes.find((n) => n.nodeId === nextId) : undefined;
    }
    const line = ordered.length ? ordered : nodes;

    const initiatorDeptInfo = initiatorUserId
      ? await this.getInitiatorDeptOptions(tenantId, initiatorUserId)
      : { options: [] as Array<{ id: string; name: string }>, primaryDeptId: undefined };
    const initiatorDeptOptions = initiatorDeptInfo.options || [];
    const selectedInitiatorDeptId =
      initiatorDeptId ||
      initiatorDeptInfo.primaryDeptId ||
      initiatorDeptOptions[0]?.id;

    const resolvedNodes = await Promise.all(
      line.map(async (n) => {
        if (!(n.type === 'approval' || n.type === 'task' || n.type === 'handler')) {
          return {
            nodeId: n.nodeId,
            type: n.type,
            label: n.label,
            assigneeUserIds: [] as string[],
            assigneeUsers: [] as Array<{ id: string; name: string }>,
          };
        }
        const ids = await this.resolveAssignedUserIds({
          tenantId,
          assignees: n.assignees,
          fallbackUserId: initiatorUserId,
          submitterIdOverride: initiatorUserId,
          draftData: data || {},
          initiatorDeptId: selectedInitiatorDeptId,
        });
        const users = ids.length
          ? await this.userRepository
              .createQueryBuilder('u')
              .select(['u.id as id', 'u.name as name', 'u.account as account'])
              .where('u.tenantId = :tenantId', { tenantId })
              .andWhere('u.status = :status', { status: 1 })
              .andWhere('u.id IN (:...ids)', { ids })
              .getRawMany()
          : [];
        const userMap = new Map(users.map((u: any) => [String(u.id), u]));
        const assigneeUsers = ids
          .map((id) => {
            const u = userMap.get(String(id));
            return { id: String(id), name: u ? String(u.name || u.account || id) : String(id) };
          })
          .filter(Boolean);
        return {
          nodeId: n.nodeId,
          type: n.type,
          label: n.label,
          assignees: n.assignees || {},
          assigneeUserIds: ids,
          assigneeUsers,
          unresolved: ids.length === 0,
        };
      }),
    );

    return {
      nodes: resolvedNodes,
      initiatorDeptOptions,
      selectedInitiatorDeptId: selectedInitiatorDeptId || '',
      syncHints: {
        leader: '若“发起人直属上级”为空，请先钉钉同步并确保 manager_userid/leaderUserId 已写入。',
        role: '若“按角色”为空，请检查该角色下是否有启用用户。',
      },
    };
  }

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

    let todoTitle = `待办：${params.nodeLabel}`;
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

      // 详情链接基址：本地优先 localhost，生产必须是公网域名（避免把 localhost 发到钉钉）
      const configuredPortalBaseUrl =
        (this.configService.get<string>('portal.baseUrl') || '').trim() ||
        process.env.PORTAL_BASE_URL ||
        process.env.PORTAL_PUBLIC_BASE_URL ||
        process.env.PUBLIC_PORTAL_URL ||
        '';
      const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
      const isProd = nodeEnv !== 'development' && nodeEnv !== 'test';
      const localDevPortal = 'http://localhost:5173';
      let portalBaseUrl = configuredPortalBaseUrl || (!isProd ? localDevPortal : '');

      if (isProd && /localhost|127\.0\.0\.1/i.test(portalBaseUrl)) {
        const serverName = String(process.env.SERVER_NAME || process.env.DOMAIN || '').trim();
        if (serverName) {
          portalBaseUrl = `https://${serverName}`;
        } else {
          portalBaseUrl = 'https://ddm.mofeng33506.xyz';
          console.warn(
            '[WorkflowService] 生产环境 PORTAL_BASE_URL 为 localhost，已自动回退到 https://ddm.mofeng33506.xyz',
          );
        }
      }

      if (!portalBaseUrl) {
        console.warn(
          '[WorkflowService] 跳过钉钉待办：未配置 PORTAL_BASE_URL（待办详情链接无法生成）。' +
            '请在 services/core/.env 中设置 PORTAL_BASE_URL 为公网可访问的前端地址，例如 https://ddm.xxx.com',
        );
        return null;
      }

      // DingTalk 待办点击后应直达审批处理页（runtime/list 的记录详情）
      let formId: string | null = null;
      let formName = '';
      let workflowName = '';
      let todoTitleTemplate = '';
      let dingtalkEnabled = true;
      let dingtalkTodoEnabled = true;
      let dingtalkMessageContent = '';
      let dingtalkRemarkTemplate = '';
      let dingtalkAppendRemark = true;
      let dingtalkMessageFormFields: Array<{ label?: string; token?: string }> = [];
      const formFieldTokenMap = new Map<string, string>();
      try {
        const inst = await this.instanceRepo.findOne({
          where: { tenantId: params.tenantId, recordId: params.recordId },
        });
        formId = inst?.formId ? String(inst.formId) : null;
        const def: any = inst?.definition || {};
        const meta: any = def?.metadata || {};
        workflowName = String(def?.workflowName || '').trim();
        todoTitleTemplate = String(meta?.dingtalk?.todoTitleTemplate || '').trim();
        dingtalkEnabled = meta?.dingtalk?.enabled !== false;
        dingtalkTodoEnabled = meta?.dingtalk?.todoEnabled !== false;
        dingtalkMessageContent = String(meta?.dingtalk?.messageContent || '').trim();
        dingtalkRemarkTemplate = String(meta?.dingtalk?.remark || '').trim();
        dingtalkAppendRemark = meta?.dingtalk?.appendRemark !== false;
        dingtalkMessageFormFields = Array.isArray(meta?.dingtalk?.messageFormFields)
          ? (meta?.dingtalk?.messageFormFields as Array<{ label?: string; token?: string }>)
          : [];
        if (formId) {
          const formDef = await this.formRepo.findOne({
            where: { tenantId: params.tenantId, formId },
          });
          formName = String(formDef?.formName || '').trim();
          const formCfg: any = (formDef as any)?.config || {};
          const collectFields = (list: any[]): any[] => {
            const out: any[] = [];
            for (const item of Array.isArray(list) ? list : []) {
              if (!item || typeof item !== "object") continue;
              if (item.type === "groupTitle" || item.type === "tab" || item.type === "multiColumn") {
                const children = item.children || (Array.isArray(item.columns) ? item.columns.flatMap((c: any) => c?.children || []) : []);
                out.push(...collectFields(children));
                continue;
              }
              out.push(item);
            }
            return out;
          };
          const flatFields = collectFields(formCfg?.elements || formCfg?.fields || []);
          flatFields.forEach((f: any) => {
            const id = String(f?.fieldId || "").trim();
            const label = String(f?.label || f?.fieldName || "").trim();
            if (!id) return;
            formFieldTokenMap.set(id, id);
            if (label) formFieldTokenMap.set(label, id);
            formFieldTokenMap.set(`{${id}}`, id);
            if (label) formFieldTokenMap.set(`{${label}}`, id);
          });
          const workflowMetaFromDefinition: any =
            (formDef as any)?.config?.workflow?.metadata?.dingtalk || {};
          if (!todoTitleTemplate) {
            todoTitleTemplate = String(workflowMetaFromDefinition?.todoTitleTemplate || '').trim();
          }
          if (!dingtalkMessageContent) {
            dingtalkMessageContent = String(workflowMetaFromDefinition?.messageContent || '').trim();
          }
          if (!dingtalkRemarkTemplate) {
            dingtalkRemarkTemplate = String(workflowMetaFromDefinition?.remark || '').trim();
          }
          if (!dingtalkMessageFormFields.length && Array.isArray(workflowMetaFromDefinition?.messageFormFields)) {
            dingtalkMessageFormFields = workflowMetaFromDefinition.messageFormFields;
          }
          if (workflowMetaFromDefinition?.appendRemark === false) {
            dingtalkAppendRemark = false;
          }
          if (workflowMetaFromDefinition?.enabled === false) {
            dingtalkEnabled = false;
          }
          if (workflowMetaFromDefinition?.todoEnabled === false) {
            dingtalkTodoEnabled = false;
          }
        }
      } catch (e) {
        // 解析失败不影响主流程，fallback 到基础待办标题/链接
        console.warn('[WorkflowService] 解析流程实例配置失败，使用默认待办标题/链接', {
          tenantId: params.tenantId,
          recordId: params.recordId,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      if (!dingtalkEnabled || !dingtalkTodoEnabled) {
        console.warn('[WorkflowService] 跳过钉钉待办推送：流程配置中已关闭钉钉提醒', {
          tenantId: params.tenantId,
          recordId: params.recordId,
          dingtalkEnabled,
          dingtalkTodoEnabled,
        });
        return null;
      }

      const detailUrl = `${portalBaseUrl}/runtime/list?recordId=${encodeURIComponent(
        params.recordId,
      )}${formId ? `&formId=${encodeURIComponent(formId)}` : ''}`;

      const formData = await this.formDataRepo.findOne({
        where: { tenantId: params.tenantId, recordId: params.recordId } as any,
      });
      const formValues = (formData?.data || {}) as Record<string, any>;
      const submitterName = String((formData as any)?.submitterName || '提交人');
      const updatedAtText = formData?.updatedAt
        ? new Date(formData.updatedAt as any).toLocaleString('zh-CN', { hour12: false })
        : new Date().toLocaleString('zh-CN', { hour12: false });

      const stringifyFieldValue = (value: any): string => {
        if (value == null) return '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return String(value);
        }
        if (Array.isArray(value)) {
          if (value.length === 0) return '';
          return value
            .map((item) => {
              if (item == null) return '';
              if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                return String(item);
              }
              if (typeof item === 'object') {
                const obj = item as Record<string, any>;
                const parts = Object.values(obj)
                  .filter((x) => x != null && x !== '')
                  .map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x)));
                return parts.join(' / ');
              }
              return String(item);
            })
            .filter(Boolean)
            .join('；');
        }
        if (typeof value === 'object') {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        }
        return String(value);
      };

      const resolveToken = (tokenRaw: string) => {
        const token = String(tokenRaw || '').trim();
        if (!token) return '';
        const inner = token.replace(/^\{|\}$/g, '');
        if (inner === '表单名称') return formName || workflowName || '审批流程';
        if (inner === '流程名称') return workflowName || formName || '审批流程';
        if (inner === '节点名称') return String(params.nodeLabel || '审批节点');
        if (inner === '记录ID') return String(params.recordId || '');
        if (inner === '提交人') return submitterName;
        if (inner === '更新时间') return updatedAtText;
        const mappedFieldId = formFieldTokenMap.get(inner) || formFieldTokenMap.get(`{${inner}}`) || inner;
        if (Object.prototype.hasOwnProperty.call(formValues, mappedFieldId)) {
          return stringifyFieldValue(formValues[mappedFieldId]);
        }
        return '';
      };

      const renderTemplate = (tpl: string) =>
        String(tpl || '').replace(/\{[^{}]+\}/g, (m) => resolveToken(m));

      const messageLines: string[] = [];
      if (dingtalkMessageContent) {
        messageLines.push(renderTemplate(dingtalkMessageContent));
      }
      const effectiveRows = dingtalkMessageFormFields.length
        ? dingtalkMessageFormFields
        : [
            { label: '表单名称', token: '{表单名称}' },
            { label: '流程名称', token: '{流程名称}' },
            { label: '提交时间', token: '{更新时间}' },
          ];
      effectiveRows.forEach((row) => {
        const label = String(row?.label || '').trim();
        const token = String(row?.token || '').trim();
        if (!label || !token) return;
        const value = resolveToken(token);
        if (!value) return;
        messageLines.push(`${label}：${value}`);
      });
      if (dingtalkAppendRemark && dingtalkRemarkTemplate) {
        const renderedRemark = renderTemplate(dingtalkRemarkTemplate).trim();
        if (renderedRemark) {
          messageLines.push(renderedRemark);
        }
      }
      const todoDescription = messageLines.filter(Boolean).join('\n') || `流程记录：${params.recordId}`;
      const renderedTitle = todoTitleTemplate ? renderTemplate(todoTitleTemplate).trim() : '';
      // 标题兜底带上核心信息，避免待办列表里只看到笼统文案
      todoTitle = (renderedTitle || `待办：${formName || workflowName || params.nodeLabel}`)
        .replace(/\s+/g, ' ')
        .trim();
      if (!renderedTitle && submitterName) {
        todoTitle = `${todoTitle}｜${submitterName}`;
      }
      if (todoTitle.length > 80) {
        todoTitle = `${todoTitle.slice(0, 80)}...`;
      }

      const created = await this.dingtalkService.addToDoTask({
        appKey: String(ding.appKey),
        appSecret: String(ding.appSecret),
        creatorUnionId,
        executorUnionIds,
        title: todoTitle,
        description: todoDescription,
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
          content: todoTitle,
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
        content: todoTitle,
        detail: err?.message || '钉钉待办推送失败',
        ip: '127.0.0.1',
      });
      return null;
    }
  }

  async start(params: { tenantId: string; formId: string; recordId: string; workflow: { nodes: WorkflowNode[]; edges: WorkflowEdge[]; workflowId?: string; workflowName?: string; metadata?: Record<string, unknown> }; userId?: string; userName?: string }) {
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
      definition: {
        workflowName: (workflow as any)?.workflowName || '',
        nodes: workflow.nodes,
        edges: workflow.edges,
        metadata: (workflow as any)?.metadata || {},
      },
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
    if (nextNode && (nextNode.type === 'approval' || nextNode.type === 'task' || nextNode.type === 'handler')) {
      const resolvedValues = await this.resolveAssignedUserIds({
        tenantId,
        recordId,
        assignees: nextNode.assignees,
        fallbackUserId: userId ? String(userId) : undefined,
      });
      (instance.tasks as any[]).push({
        taskId: `tk_${Date.now()}`,
        nodeId: nextNode.nodeId,
        nodeType: nextNode.type,
        label: nextNode.label,
        assignees: {
          ...(nextNode.assignees || {}),
          values: resolvedValues,
        },
        status: 'pending',
        createdAt: now.toISOString(),
      });
    }

    const saved = await this.instanceRepo.save(instance);

    // 创建待办推送到钉钉（如果该流程第一个节点需要指派）
    if (nextNode && (nextNode.type === 'approval' || nextNode.type === 'task' || nextNode.type === 'handler')) {
      const firstTask = (instance.tasks as any[])[0];
      const assignees = firstTask?.assignees || {};
      const values: string[] = Array.isArray(assignees.values) ? assignees.values.map(String) : [];
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
    // 不存在时返回 null，避免前端“先探测再创建”场景触发 404 噪音
    return inst || null;
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
        (prevNode.type === 'approval' || prevNode.type === 'task' || prevNode.type === 'handler' || prevNode.type === 'start')
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
    if (nextNode.type === 'approval' || nextNode.type === 'task' || nextNode.type === 'handler') {
      const resolvedValues = await this.resolveAssignedUserIds({
        tenantId,
        recordId: String(inst.recordId),
        assignees: nextNode.assignees,
        fallbackUserId: payload.userId ? String(payload.userId) : undefined,
      });
      (inst.tasks as any[]).push({
        taskId: `tk_${Date.now()}`,
        nodeId: nextNode.nodeId,
        nodeType: nextNode.type,
        label: nextNode.label,
        assignees: {
          ...(nextNode.assignees || {}),
          values: resolvedValues,
        },
        status: 'pending',
      });
    }

    const saved = await this.instanceRepo.save(inst);

    // 推送待办到钉钉
    if (nextNode.type === 'approval' || nextNode.type === 'task' || nextNode.type === 'handler') {
      const createdTask = (inst.tasks as any[]).find((t: any) => t.nodeId === nextNode.nodeId && t.status === 'pending');
      const assignees = createdTask?.assignees || {};
      const values: string[] = Array.isArray(assignees.values) ? assignees.values.map(String) : [];
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
