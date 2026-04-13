import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormDataEntity } from '../../database/entities/form-data.entity';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { UserRoleEntity } from '../../database/entities/user-role.entity';
import { RoleEntity } from '../../database/entities/role.entity';
import { WorkflowInstanceEntity } from '../../database/entities/workflow-instance.entity';
import { SubmitFormDataDto } from './dto/submit-form-data.dto';
import { BusinessRuleExecutorService } from '../business-rule/business-rule.executor';
import { OperationLogService } from '../operation-log/operation-log.service';
import { TenantLimitsService } from '../tenant-metrics/tenant-limits.service';

@Injectable()
export class FormDataService {
  constructor(
    @InjectRepository(FormDataEntity)
    private formDataRepository: Repository<FormDataEntity>,
    @InjectRepository(FormDefinitionEntity)
    private formDefinitionRepository: Repository<FormDefinitionEntity>,
    @InjectRepository(UserRoleEntity)
    private userRoleRepository: Repository<UserRoleEntity>,
    @InjectRepository(WorkflowInstanceEntity)
    private workflowInstanceRepository: Repository<WorkflowInstanceEntity>,
    @Inject(forwardRef(() => BusinessRuleExecutorService))
    private ruleExecutor: BusinessRuleExecutorService,
    private operationLogService: OperationLogService,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  private parseConfig(raw: any): any {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw;
  }

  private async findOneRaw(recordId: string): Promise<FormDataEntity> {
    const formData = await this.formDataRepository.findOne({
      where: { recordId },
    });
    if (!formData) {
      throw new NotFoundException(`表单数据 ${recordId} 不存在`);
    }
    return formData;
  }

  private async getUserRoleIds(params: { userId?: string; tenantId: string }): Promise<string[]> {
    const userId = params.userId ? String(params.userId) : '';
    if (!userId) return [];
    // user_roles 没有 tenantId，tenant 归属在 roles 表
    const rows = await this.userRoleRepository
      .createQueryBuilder('ur')
      .leftJoin(RoleEntity, 'r', 'r.id = ur.roleId')
      .where('ur.userId = :userId', { userId })
      .andWhere('r.tenantId = :tenantId', { tenantId: String(params.tenantId) })
      .select(['ur.roleId as roleId'])
      .getRawMany();
    return rows.map((x: any) => String(x.roleId)).filter(Boolean);
  }

  private computeAction(params: {
    fieldPermissions?: any;
    nodeId?: string;
    roleIds: string[];
    key: string;
  }): 'hidden' | 'readonly' | 'editable' {
    const fp = params.fieldPermissions;
    const fallback = fp?.defaults?.fallback || 'editable';

    const nodeRule =
      params.nodeId && fp?.nodeRules && fp.nodeRules[String(params.nodeId)]
        ? fp.nodeRules[String(params.nodeId)][params.key]
        : undefined;

    if (nodeRule) return nodeRule;

    const roleRules = fp?.roleRules || {};
    const hits: string[] = [];
    for (const rid of params.roleIds || []) {
      const a = roleRules?.[String(rid)]?.[params.key];
      if (a) hits.push(a);
    }
    if (hits.includes('hidden')) return 'hidden';
    if (hits.includes('readonly')) return 'readonly';
    if (hits.includes('editable')) return 'editable';
    return fallback;
  }

  private applyReadFilter(params: {
    data: Record<string, any>;
    fieldPermissions?: any;
    nodeId?: string;
    roleIds: string[];
  }): Record<string, any> {
    const next: Record<string, any> = { ...(params.data || {}) };
    const fp = params.fieldPermissions;
    if (!fp || typeof fp !== 'object') return next;

    // 过滤主表字段（key 不含点）
    for (const key of Object.keys(next)) {
      if (key.includes('.')) continue;
      const action = this.computeAction({
        fieldPermissions: fp,
        nodeId: params.nodeId,
        roleIds: params.roleIds,
        key,
      });
      if (action === 'hidden') {
        delete next[key];
      }
    }

    // 过滤子表列（key = subId.colId）
    const nodeRules = (params.nodeId && fp?.nodeRules?.[String(params.nodeId)]) || {};
    const roleRules = fp?.roleRules || {};
    const allRuleKeys = new Set<string>();
    Object.keys(nodeRules || {}).forEach((k) => allRuleKeys.add(k));
    for (const rid of params.roleIds || []) {
      Object.keys(roleRules?.[String(rid)] || {}).forEach((k) => allRuleKeys.add(k));
    }

    for (const ruleKey of Array.from(allRuleKeys)) {
      if (!ruleKey.includes('.')) continue;
      const [subId, colId] = ruleKey.split('.');
      if (!subId || !colId) continue;
      const action = this.computeAction({
        fieldPermissions: fp,
        nodeId: params.nodeId,
        roleIds: params.roleIds,
        key: ruleKey,
      });
      if (action !== 'hidden') continue;
      const arr = next[subId];
      if (Array.isArray(arr)) {
        next[subId] = arr.map((row: any) => {
          if (!row || typeof row !== 'object') return row;
          const r = { ...row };
          delete r[colId];
          return r;
        });
      }
    }
    return next;
  }

  private applyWriteFilter(params: {
    incoming: Record<string, any>;
    fieldPermissions?: any;
    nodeId?: string;
    roleIds: string[];
  }): { cleaned: Record<string, any>; ignoredFields: string[] } {
    const cleaned: Record<string, any> = { ...(params.incoming || {}) };
    const ignoredFields: string[] = [];
    const fp = params.fieldPermissions;
    if (!fp || typeof fp !== 'object') return { cleaned, ignoredFields };

    // 主表字段
    for (const key of Object.keys(cleaned)) {
      if (key.includes('.')) continue;
      const action = this.computeAction({
        fieldPermissions: fp,
        nodeId: params.nodeId,
        roleIds: params.roleIds,
        key,
      });
      if (action !== 'editable') {
        ignoredFields.push(key);
        delete cleaned[key];
      }
    }

    // 子表列
    const nodeRules = (params.nodeId && fp?.nodeRules?.[String(params.nodeId)]) || {};
    const roleRules = fp?.roleRules || {};
    const allRuleKeys = new Set<string>();
    Object.keys(nodeRules || {}).forEach((k) => allRuleKeys.add(k));
    for (const rid of params.roleIds || []) {
      Object.keys(roleRules?.[String(rid)] || {}).forEach((k) => allRuleKeys.add(k));
    }
    for (const ruleKey of Array.from(allRuleKeys)) {
      if (!ruleKey.includes('.')) continue;
      const [subId, colId] = ruleKey.split('.');
      if (!subId || !colId) continue;
      const action = this.computeAction({
        fieldPermissions: fp,
        nodeId: params.nodeId,
        roleIds: params.roleIds,
        key: ruleKey,
      });
      if (action !== 'editable') {
        const arr = cleaned[subId];
        if (Array.isArray(arr)) {
          cleaned[subId] = arr.map((row: any) => {
            if (!row || typeof row !== 'object') return row;
            const r = { ...row };
            if (colId in r) {
              ignoredFields.push(ruleKey);
              delete r[colId];
            }
            return r;
          });
        }
      }
    }
    return { cleaned, ignoredFields };
  }

  async submit(
    submitDto: SubmitFormDataDto,
    userId: string,
    userName?: string,
  ): Promise<FormDataEntity> {
    // form_id 在库中全局唯一：按 formId 解析真实租户，避免“默认租户”与表单所属租户不一致导致 404
    const formDefinition = await this.formDefinitionRepository.findOne({
      where: { formId: submitDto.formId },
    });

    if (!formDefinition) {
      throw new NotFoundException(`表单定义 ${submitDto.formId} 不存在`);
    }

    const tenantId = formDefinition.tenantId;
    const config = this.parseConfig(formDefinition.config);
    const fieldPermissions = config?.metadata?.fieldPermissions;
    const roleIds = await this.getUserRoleIds({ userId, tenantId: String(tenantId) });

    // 如果提供了 recordId，说明是编辑模式，调用 update 方法
    if (submitDto.recordId) {
      return this.update(submitDto.recordId, submitDto, userId, userName);
    }

    await this.tenantLimitsService.assertCanCreateRecord(tenantId);

    // 创建表单数据记录
    // TypeORM的json类型会自动序列化，直接传入对象即可
    const formData = this.formDataRepository.create({
      formId: submitDto.formId,
      tenantId,
      recordId: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: (() => {
        // 新增默认节点视为 start（发起）
        const { cleaned, ignoredFields } = this.applyWriteFilter({
          incoming: submitDto.data,
          fieldPermissions,
          nodeId: 'start',
          roleIds,
        });
        (submitDto as any).__ignoredFields = ignoredFields;
        return cleaned;
      })(), // TypeORM会自动处理JSON序列化
      submitterId: userId,
      submitterName: userName,
      status: submitDto.status || 'submitted',
    });

    const saved = await this.formDataRepository.save(formData);

    // 记录操作日志（创建）
    try {
      await this.operationLogService.logOperation(
        tenantId,
        submitDto.formId,
        saved.recordId,
        'create',
        userId,
        userName,
        undefined, // 创建时没有字段变更
        '创建记录',
      );
    } catch (error) {
      console.error('记录操作日志失败:', error);
    }

    // 触发业务规则（数据生效时）
    try {
      await this.ruleExecutor.handleEvent('create', {
        formId: submitDto.formId,
        tenantId,
        recordId: saved.recordId,
        data: saved.data,
        userId,
      });
    } catch (error) {
      // 业务规则执行失败不影响数据保存，只记录日志
      console.error('业务规则执行失败:', error);
    }

    const ignoredFields = (submitDto as any).__ignoredFields || [];
    return Object.assign(saved as any, { ignoredFields });
  }

  async update(
    recordId: string,
    updateDto: Partial<SubmitFormDataDto>,
    userId: string,
    userName?: string,
  ): Promise<FormDataEntity> {
    const existingRecord = await this.findOneRaw(recordId);
    const tenantId = existingRecord.tenantId;
    const oldData = { ...existingRecord.data };

    // 读取表单定义字段权限与当前节点
    const formDefinition = await this.formDefinitionRepository.findOne({
      where: { formId: existingRecord.formId },
    });
    const config = this.parseConfig(formDefinition?.config);
    const fieldPermissions = config?.metadata?.fieldPermissions;
    const roleIds = await this.getUserRoleIds({ userId, tenantId: String(tenantId) });
    const inst = await this.workflowInstanceRepository.findOne({
      where: { recordId, tenantId: String(tenantId) } as any,
    });
    const nodeId = inst?.currentNodeId || 'start';

    // 更新数据
    const incoming = updateDto.data || existingRecord.data;
    const { cleaned, ignoredFields } = this.applyWriteFilter({
      incoming,
      fieldPermissions,
      nodeId,
      roleIds,
    });
    const updatedData = cleaned;
    Object.assign(existingRecord, {
      data: updatedData,
      submitterId: userId,
      submitterName: userName,
      status: updateDto.status ?? existingRecord.status,
    });

    const saved = await this.formDataRepository.save(existingRecord);

    // 计算字段变更
    const fieldChanges: Array<{
      fieldId: string;
      fieldLabel?: string;
      oldValue: any;
      newValue: any;
    }> = [];

    if (formDefinition && formDefinition.config) {
      const config = typeof formDefinition.config === 'string'
        ? JSON.parse(formDefinition.config)
        : formDefinition.config;
      const fields = config.fields || [];

      // 比较每个字段的变化
      for (const field of fields) {
        const fieldId = field.fieldId || field.id;
        if (!fieldId) continue;

        const oldValue = oldData[fieldId];
        const newValue = updatedData[fieldId];

        // 使用JSON比较，避免对象引用问题
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          fieldChanges.push({
            fieldId,
            fieldLabel: field.label || field.name || fieldId,
            oldValue,
            newValue,
          });
        }
      }
    }

    // 记录操作日志（更新）
    try {
      await this.operationLogService.logOperation(
        tenantId,
        existingRecord.formId,
        recordId,
        'update',
        userId,
        userName,
        fieldChanges.length > 0 ? fieldChanges : undefined,
        fieldChanges.length > 0
          ? `更新了 ${fieldChanges.length} 个字段`
          : '更新记录',
      );
    } catch (error) {
      console.error('记录操作日志失败:', error);
    }

    // 触发业务规则（数据生效时）
    try {
      await this.ruleExecutor.handleEvent('update', {
        formId: existingRecord.formId,
        tenantId,
        recordId: saved.recordId,
        data: saved.data,
        userId,
      });
    } catch (error) {
      console.error('业务规则执行失败:', error);
    }

    return Object.assign(saved as any, { ignoredFields });
  }

  async findAll(formId: string, actor?: { userId?: string }): Promise<FormDataEntity[]> {
    const fd = await this.formDefinitionRepository.findOne({ where: { formId } });
    if (!fd) {
      throw new NotFoundException(`表单定义 ${formId} 不存在`);
    }
    const list = await this.formDataRepository.find({
      where: { formId, tenantId: fd.tenantId },
      order: { createdAt: 'DESC' },
    });
    const config = this.parseConfig(fd.config);
    const fieldPermissions = config?.metadata?.fieldPermissions;
    const roleIds = await this.getUserRoleIds({
      userId: actor?.userId,
      tenantId: String(fd.tenantId),
    });
    // 列表页通常不带节点上下文：按角色规则过滤即可（节点可在详情页再精确控制）
    return list.map((r) => {
      const filtered = this.applyReadFilter({
        data: r.data as any,
        fieldPermissions,
        nodeId: undefined,
        roleIds,
      });
      return Object.assign(r as any, { data: filtered });
    });
  }

  async findPaged(
    formId: string,
    paging: { page: number; pageSize: number },
    actor?: { userId?: string },
  ): Promise<{ items: FormDataEntity[]; total: number }> {
    const fd = await this.formDefinitionRepository.findOne({ where: { formId } });
    if (!fd) {
      throw new NotFoundException(`表单定义 ${formId} 不存在`);
    }

    const page = Math.max(1, Number(paging.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(paging.pageSize) || 20));

    const [items, total] = await this.formDataRepository.findAndCount({
      where: { formId, tenantId: fd.tenantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const config = this.parseConfig(fd.config);
    const fieldPermissions = config?.metadata?.fieldPermissions;
    const roleIds = await this.getUserRoleIds({
      userId: actor?.userId,
      tenantId: String(fd.tenantId),
    });

    const filteredItems = items.map((r) => {
      const filtered = this.applyReadFilter({
        data: r.data as any,
        fieldPermissions,
        nodeId: undefined,
        roleIds,
      });
      return Object.assign(r as any, { data: filtered });
    });

    return { items: filteredItems, total };
  }

  /**
   * 供业务规则使用：按 JSON 字段等值查找（仅覆盖当前规则引擎的 = 条件模型）
   * 注意：fieldId 为 data 中的一级 key，例如 field_xxx / subfield_xxx
   */
  async findByJsonFieldEquals(options: {
    formId: string;
    tenantId: string | number;
    fieldId: string;
    value: any;
    take?: number;
  }): Promise<FormDataEntity[]> {
    const { formId, tenantId, fieldId, value, take } = options;
    // MySQL JSON 路径需要对 key 做引号转义：$."fieldId"
    const jsonPath = `$.\"${String(fieldId).replaceAll('"', '\\"')}\"`;

    const qb = this.formDataRepository
      .createQueryBuilder('fd')
      .where('fd.formId = :formId', { formId })
      .andWhere('fd.tenantId = :tenantId', { tenantId: String(tenantId) })
      // JSON_UNQUOTE 确保字符串对比一致；数值/布尔值也会转为字符串对比（与当前 evaluateCondition 的 == 行为一致）
      .andWhere("JSON_UNQUOTE(JSON_EXTRACT(fd.data, :jsonPath)) = :val", {
        jsonPath,
        val: value == null ? '' : String(value),
      })
      .orderBy('fd.createdAt', 'DESC');

    if (take && take > 0) qb.take(take);

    return qb.getMany();
  }

  async findOne(recordId: string, actor?: { userId?: string }): Promise<FormDataEntity> {
    const formData = await this.findOneRaw(recordId);

    // 字段权限过滤（按当前流程节点 + 角色）
    const formDefinition = await this.formDefinitionRepository.findOne({
      where: { formId: formData.formId },
    });
    const config = this.parseConfig(formDefinition?.config);
    const fieldPermissions = config?.metadata?.fieldPermissions;
    const roleIds = await this.getUserRoleIds({
      userId: actor?.userId,
      tenantId: String(formData.tenantId),
    });
    const inst = await this.workflowInstanceRepository.findOne({
      where: { recordId, tenantId: String(formData.tenantId) } as any,
    });
    const nodeId = inst?.currentNodeId || 'start';
    const filtered = this.applyReadFilter({
      data: formData.data as any,
      fieldPermissions,
      nodeId,
      roleIds,
    });
    return Object.assign(formData as any, { data: filtered });
  }

  async remove(recordId: string, userId?: string, userName?: string): Promise<void> {
    const formData = await this.findOne(recordId);
    const tenantId = formData.tenantId;

    // 记录操作日志（删除）
    try {
      await this.operationLogService.logOperation(
        tenantId,
        formData.formId,
        recordId,
        'delete',
        userId || 'system',
        userName,
        undefined,
        '删除记录',
      );
    } catch (error) {
      console.error('记录操作日志失败:', error);
    }

    // 触发业务规则（数据作废时）
    try {
      await this.ruleExecutor.handleEvent('delete', {
        formId: formData.formId,
        tenantId,
        recordId: formData.recordId,
        data: formData.data,
        userId: userId || 'system',
      });
    } catch (error) {
      console.error('业务规则执行失败:', error);
    }

    await this.formDataRepository.remove(formData);
  }
}
