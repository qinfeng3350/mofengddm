import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessRuleEntity } from '../../database/entities/business-rule.entity';
import { FormDataEntity } from '../../database/entities/form-data.entity';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { FormDataService } from '../form-data/form-data.service';
import { OperationLogService } from '../operation-log/operation-log.service';

interface RuleContext {
  formId: string;
  tenantId: string;
  recordId: string;
  data: Record<string, any>;
  userId?: string;
  ruleId?: string;
  ruleName?: string;
  triggerEvent?: 'create' | 'update' | 'delete' | 'statusChange';
}

@Injectable()
export class BusinessRuleExecutorService {
  private readonly logger = new Logger(BusinessRuleExecutorService.name);

  constructor(
    @InjectRepository(BusinessRuleEntity)
    private businessRuleRepository: Repository<BusinessRuleEntity>,
    @InjectRepository(FormDataEntity)
    private formDataRepository: Repository<FormDataEntity>,
    @InjectRepository(FormDefinitionEntity)
    private formDefinitionRepository: Repository<FormDefinitionEntity>,
    @Inject(forwardRef(() => FormDataService))
    private formDataService: FormDataService,
    private operationLogService: OperationLogService,
  ) {}

  /**
   * 处理表单事件（创建/更新/删除/状态变化）
   */
  async handleEvent(
    event: 'create' | 'update' | 'delete' | 'statusChange',
    context: RuleContext,
  ): Promise<void> {
    try {
      // 如果是 statusChange 事件且没有数据，从数据库获取当前记录的数据
      let enhancedContext = context;
      if (event === 'statusChange' && context.recordId && (!context.data || Object.keys(context.data).length === 0)) {
        try {
          const record = await this.formDataService.findOne(context.recordId);
          enhancedContext = {
            ...context,
            data: record.data || {},
          };
          this.logger.log(`[业务规则] statusChange 事件：已获取记录数据，字段数量: ${Object.keys(record.data || {}).length}`);
        } catch (error) {
          this.logger.warn(`[业务规则] statusChange 事件：获取记录数据失败:`, error);
        }
      }

      // 查找该表单的所有启用规则
      // 注意：TypeORM对JSON字段的查询可能不准确，先查询所有规则再过滤
      const allRules = await this.businessRuleRepository.find({
        where: {
          tenantId: enhancedContext.tenantId,
          enabled: true,
        },
      });

      // 过滤出匹配的规则：formId和event都匹配
      const rules = allRules.filter((rule) => {
        const trigger = rule.trigger;
        return (
          trigger &&
          trigger.formId === enhancedContext.formId &&
          trigger.event === event
        );
      });

      // 记录找到的规则数量
      this.logger.log(`[业务规则] 表单 ${enhancedContext.formId} 事件 ${event}: 找到 ${rules.length} 条匹配规则`);

      // 按优先级排序
      rules.sort((a, b) => b.priority - a.priority);

      // 执行每个规则
      for (const rule of rules) {
        try {
          this.logger.log(`[业务规则] 执行规则: ${rule.ruleName} (${rule.ruleId})`);
          
          // 检查触发条件
          const conditionsMet = this.checkTriggerConditions(rule.trigger.conditions || [], enhancedContext.data);
          this.logger.log(`[业务规则] 规则 ${rule.ruleId} 触发条件检查: ${conditionsMet ? '通过' : '未通过'}`);
          
          if (conditionsMet) {
            this.logger.log(`[业务规则] 开始执行规则 ${rule.ruleId} 的动作，共 ${rule.actions.length} 个动作`);
            await this.executeActions(rule.actions, {
              ...enhancedContext,
              ruleId: rule.ruleId,
              ruleName: rule.ruleName,
              triggerEvent: event,
            });
            this.logger.log(`[业务规则] 规则 ${rule.ruleId} 执行完成`);
          }
        } catch (error) {
          this.logger.error(`[业务规则] 执行规则 ${rule.ruleId} 失败:`, error);
          // 继续执行下一个规则，不中断
        }
      }
    } catch (error) {
      this.logger.error(`处理事件 ${event} 失败:`, error);
      throw error;
    }
  }

  /**
   * 检查触发条件
   */
  private checkTriggerConditions(
    conditions: Array<{ fieldId: string; operator: string; value: any }>,
    data: Record<string, any>,
  ): boolean {
    if (!conditions || conditions.length === 0) {
      return true; // 无条件则默认触发
    }

    for (const condition of conditions) {
      const fieldValue = this.resolveFieldValue(data, condition.fieldId);
      const conditionValue = condition.value;

      let result = false;
      switch (condition.operator) {
        case '==':
        case '=':
          result = fieldValue == conditionValue;
          break;
        case '!=':
        case '<>':
          result = fieldValue != conditionValue;
          break;
        case '>':
          result = fieldValue > conditionValue;
          break;
        case '>=':
          result = fieldValue >= conditionValue;
          break;
        case '<':
          result = fieldValue < conditionValue;
          break;
        case '<=':
          result = fieldValue <= conditionValue;
          break;
        case 'contains':
          result = String(fieldValue).includes(String(conditionValue));
          break;
        case 'in':
          result = Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
          break;
        default:
          this.logger.warn(`未知的操作符: ${condition.operator}`);
          result = false;
      }

      if (!result) {
        return false; // 有一个条件不满足就返回false
      }
    }

    return true;
  }

  /**
   * 执行动作列表
   */
  private async executeActions(
    actions: BusinessRuleEntity['actions'],
    context: RuleContext,
  ): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action, context);
    }
  }

  /**
   * 执行单个动作
   */
  private async executeAction(
    action: BusinessRuleEntity['actions'][0],
    context: RuleContext,
  ): Promise<void> {
    this.logger.log(`[业务规则] 执行动作类型: ${action.type}`);
    
    switch (action.type) {
      case 'executeScript':
        // 高级模式：执行脚本
        this.logger.log(`[业务规则] 执行脚本: ${action.script?.substring(0, 100)}...`);
        await this.executeScript(action.script || '', context);
        break;
      case 'createRecord':
        this.logger.log(`[业务规则] 创建记录到表单: ${action.targetFormId}`);
        await this.createTargetRecord(action, context);
        break;
      case 'updateRecord':
        this.logger.log(`[业务规则] 更新记录到表单: ${action.targetFormId}`);
        await this.updateTargetRecord(action, context);
        break;
      case 'deleteRecord':
        this.logger.log(`[业务规则] 删除记录: ${action.targetRecordId}`);
        await this.deleteTargetRecord(action, context);
        break;
      default:
        this.logger.warn(`[业务规则] 未知的动作类型: ${action.type}`);
    }
  }

  /**
   * 执行脚本（高级模式）
   * 支持 INSERT/UPDATE/UPSERT/DELETE/FOR_EACH 等函数
   */
  private async executeScript(script: string, context: RuleContext): Promise<void> {
    if (!script || !script.trim()) {
      return;
    }

    // 解析函数调用
    const functionCalls = this.parseFunctionCalls(script);

    for (const funcCall of functionCalls) {
      await this.executeFunctionCall(funcCall, context);
    }
  }

  /**
   * 解析函数调用（支持嵌套括号）
   * 支持格式：FUNCTION_NAME(arg1, arg2, ...)
   */
  private parseFunctionCalls(script: string): Array<{
    name: string;
    args: string[];
  }> {
    const calls: Array<{ name: string; args: string[] }> = [];
    let i = 0;

    while (i < script.length) {
      // 跳过空白字符
      while (i < script.length && /\s/.test(script[i])) {
        i++;
      }
      if (i >= script.length) break;

      // 查找函数名（字母、数字、下划线）
      const funcNameStart = i;
      while (i < script.length && /[\w]/.test(script[i])) {
        i++;
      }
      if (i === funcNameStart) {
        i++;
        continue;
      }

      const funcName = script.substring(funcNameStart, i);

      // 跳过空白字符
      while (i < script.length && /\s/.test(script[i])) {
        i++;
      }

      // 如果不是以 ( 开头，跳过
      if (i >= script.length || script[i] !== '(') {
        continue;
      }

      i++; // 跳过 (

      // 查找匹配的右括号（支持嵌套括号）
      let depth = 1;
      const argsStart = i;
      while (i < script.length && depth > 0) {
        if (script[i] === '(') {
          depth++;
        } else if (script[i] === ')') {
          depth--;
        }
        if (depth > 0) {
          i++;
        }
      }

      const argsStr = script.substring(argsStart, i);
      i++; // 跳过 )

      // 解析参数
      const args = this.parseFunctionArgs(argsStr);
      calls.push({ name: funcName, args });
    }

    return calls;
  }

  /**
   * 解析函数参数（支持嵌套括号和引号）
   */
  private parseFunctionArgs(argsStr: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
        current += char;
      } else if (!inQuotes) {
        if (char === '(') {
          depth++;
          current += char;
        } else if (char === ')') {
          depth--;
          current += char;
        } else if (char === ',' && depth === 0) {
          args.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(current.trim());
    }

    return args;
  }

  /**
   * 执行函数调用
   */
  private async executeFunctionCall(
    funcCall: { name: string; args: string[] },
    context: RuleContext,
  ): Promise<void> {
    const funcName = funcCall.name.toUpperCase();
    const args = funcCall.args;

    switch (funcName) {
      case 'INSERT':
        await this.executeInsert(args, context);
        break;
      case 'UPDATE':
        await this.executeUpdate(args, context);
        break;
      case 'UPDATE_CURRENT':
        await this.executeUpdateCurrent(args, context);
        break;
      case 'UPSERT':
        await this.executeUpsert(args, context);
        break;
      case 'DELETE':
        await this.executeDelete(args, context);
        break;
      case 'FOR_EACH':
        await this.executeForEach(args, context);
        break;
      default:
        this.logger.warn(`未知的函数: ${funcName}`);
    }
  }

  /**
   * 执行 INSERT(目标表单ID, 字段1=值1, 字段2=值2, ...)
   */
  private async executeInsert(args: string[], context: RuleContext): Promise<void> {
    if (args.length < 2) {
      throw new Error('INSERT 函数至少需要2个参数：目标表单ID和字段映射');
    }

    const targetFormId = this.resolveValue(args[0], context);
    const fieldMapping: Record<string, any> = {};

    // 解析字段映射：字段ID=值
    for (let i = 1; i < args.length; i++) {
      const mapping = args[i];
      const equalIndex = mapping.indexOf('=');
      if (equalIndex > 0) {
        const fieldId = mapping.substring(0, equalIndex).trim();
        const valueExpr = mapping.substring(equalIndex + 1).trim();
        fieldMapping[fieldId] = this.resolveValue(valueExpr, context);
      }
    }

    // 创建记录
    await this.formDataService.submit(
      {
        formId: targetFormId,
        data: fieldMapping,
      },
      context.userId || 'system',
    );
  }

  /**
   * 执行 UPDATE_CURRENT(字段1=值1, 字段2=值2, ...)
   * 更新当前表单的当前记录（通过 context.recordId）
   */
  private async executeUpdateCurrent(args: string[], context: RuleContext): Promise<void> {
    if (!context.recordId) {
      throw new Error('UPDATE_CURRENT 函数需要 context.recordId，但当前上下文中没有 recordId');
    }

    this.logger.log(`[UPDATE_CURRENT] 开始执行，更新记录: ${context.recordId}`);

    // 获取当前记录
    const currentRecord = await this.formDataService.findOne(context.recordId);
    const oldData = { ...currentRecord.data };

    // 解析字段映射
    const fieldMapping: Record<string, any> = {};
    for (let i = 0; i < args.length; i++) {
      const mapping = args[i];
      const equalIndex = mapping.indexOf('=');
      if (equalIndex > 0) {
        const fieldId = mapping.substring(0, equalIndex).trim();
        const valueExpr = mapping.substring(equalIndex + 1).trim();
        fieldMapping[fieldId] = this.resolveValue(valueExpr, context);
        this.logger.log(`[UPDATE_CURRENT] 字段 ${fieldId} = ${JSON.stringify(fieldMapping[fieldId])}`);
      }
    }

    // 更新记录
    const updatedData = { ...oldData, ...fieldMapping };
    await this.formDataRepository.update(
      { recordId: context.recordId, tenantId: context.tenantId },
      { data: updatedData },
    );
    const changedFields = Object.keys(fieldMapping);
    const fieldChanges = this.buildFieldChanges(oldData, updatedData, changedFields);
    if (fieldChanges.length > 0) {
      await this.operationLogService.logOperation(
        context.tenantId,
        context.formId,
        context.recordId,
        'update',
        context.userId || 'system',
        `业务规则:${context.ruleName || '未命名规则'}`,
        fieldChanges,
        this.buildRuleDescription(context),
      );
    }

    this.logger.log(`[UPDATE_CURRENT] 记录更新成功`);
  }

  /**
   * 执行 UPDATE(目标表单ID, 条件, 字段1=值1, 字段2=值2, ...)
   */
  private async executeUpdate(args: string[], context: RuleContext): Promise<void> {
    if (args.length < 3) {
      throw new Error('UPDATE 函数至少需要3个参数：目标表单ID、条件和字段映射');
    }

    const targetFormId = this.resolveValue(args[0], context);
    const condition = args[1];
    const fieldMapping: Record<string, any> = {};

    // 解析字段映射
    for (let i = 2; i < args.length; i++) {
      const mapping = args[i];
      const equalIndex = mapping.indexOf('=');
      if (equalIndex > 0) {
        const fieldId = mapping.substring(0, equalIndex).trim();
        const valueExpr = mapping.substring(equalIndex + 1).trim();
        fieldMapping[fieldId] = this.resolveValue(valueExpr, context);
      }
    }

    // 仅支持当前引擎的「=」条件：left=right
    const equalIndex = condition.indexOf('=');
    if (equalIndex <= 0) return;
    const leftExpr = condition.substring(0, equalIndex).trim();
    const rightExpr = condition.substring(equalIndex + 1).trim();
    const fieldId = leftExpr.includes('.') ? leftExpr.split('.').pop()!.trim() : leftExpr;
    const rightValue = this.resolveValue(rightExpr, context);

    // 数据库侧筛选匹配记录（避免全表 findAll）
    const matchedRecords = await this.formDataService.findByJsonFieldEquals({
      formId: String(targetFormId),
      tenantId: context.tenantId,
      fieldId,
      value: rightValue,
      take: 500,
    });

    for (const record of matchedRecords) {
      const oldData = { ...(record.data || {}) };
      const updatedData = { ...record.data, ...fieldMapping };
      await this.formDataRepository.update(
        { recordId: record.recordId, tenantId: context.tenantId },
        { data: updatedData },
      );
      const changedFields = Object.keys(fieldMapping);
      const fieldChanges = this.buildFieldChanges(oldData, updatedData, changedFields);
      if (fieldChanges.length > 0) {
        await this.operationLogService.logOperation(
          context.tenantId,
          String(targetFormId),
          record.recordId,
          'update',
          context.userId || 'system',
          `业务规则:${context.ruleName || '未命名规则'}`,
          fieldChanges,
          this.buildRuleDescription(context),
        );
      }
    }
  }

  /**
   * 执行 UPSERT(目标表单ID, 条件, 字段1=值1, 字段2=值2, ...)
   */
  private async executeUpsert(args: string[], context: RuleContext): Promise<void> {
    if (args.length < 3) {
      throw new Error('UPSERT 函数至少需要3个参数：目标表单ID、条件和字段映射');
    }

    this.logger.log(`[UPSERT] 开始执行，参数数量: ${args.length}`);
    this.logger.log(`[UPSERT] 原始参数列表:`, args.map((a, i) => `arg${i}=${a.substring(0, 100)}`).join(', '));
    
    // 目标表单ID：直接使用原始值，不进行解析（因为它是表单ID，不是字段引用）
    const targetFormId = args[0].trim();
    this.logger.log(`[UPSERT] 目标表单ID: ${targetFormId}`);
    const condition = args[1];
    this.logger.log(`[UPSERT] 匹配条件: ${condition}`);
    
    // 仅支持当前引擎的「=」条件：left=right（用于定位目标记录）
    const equalIndex = condition.indexOf('=');
    const leftExpr = equalIndex > 0 ? condition.substring(0, equalIndex).trim() : '';
    const rightExpr = equalIndex > 0 ? condition.substring(equalIndex + 1).trim() : '';
    const fieldId = leftExpr ? (leftExpr.includes('.') ? leftExpr.split('.').pop()!.trim() : leftExpr) : '';
    const rightValue = rightExpr ? this.resolveValue(rightExpr, context) : undefined;

    const matchedRecord = fieldId
      ? (await this.formDataService.findByJsonFieldEquals({
          formId: String(targetFormId),
          tenantId: context.tenantId,
          fieldId,
          value: rightValue,
          take: 1,
        }))[0]
      : undefined;

    // 创建增强的上下文，包含目标记录数据（用于解析"表单名.字段ID"）
    const enhancedContext: RuleContext = {
      ...context,
      // 在上下文中添加目标记录数据，这样 IFNULL(库存表.数量,0) 可以正确解析
      data: {
        ...context.data,
        [targetFormId]: matchedRecord?.data || {}, // 将目标记录数据添加到上下文中
      },
    };

    // 解析字段映射（使用增强的上下文）
    const finalFieldMapping: Record<string, any> = {};
    this.logger.log(`[UPSERT] 开始解析字段映射，从参数索引 2 开始，共 ${args.length - 2} 个字段映射`);
    
    for (let i = 2; i < args.length; i++) {
      const mapping = args[i];
      this.logger.log(`[UPSERT] 解析字段映射 ${i - 2}: ${mapping.substring(0, 150)}`);
      
      const equalIndex = mapping.indexOf('=');
      if (equalIndex > 0) {
        const fieldId = mapping.substring(0, equalIndex).trim();
        const valueExpr = mapping.substring(equalIndex + 1).trim();
        this.logger.log(`[UPSERT] 字段ID: ${fieldId}, 值表达式: ${valueExpr.substring(0, 100)}`);
        
        // 使用增强的上下文解析值表达式
        const resolvedValue = this.resolveValue(valueExpr, enhancedContext);
        this.logger.log(`[UPSERT] 解析后的值: ${JSON.stringify(resolvedValue)}`);
        finalFieldMapping[fieldId] = resolvedValue;
      } else {
        this.logger.warn(`[UPSERT] 字段映射格式错误（未找到=号）: ${mapping.substring(0, 100)}`);
      }
    }
    
    this.logger.log(`[UPSERT] 字段映射解析完成，共 ${Object.keys(finalFieldMapping).length} 个字段`);

    if (matchedRecord) {
      // 更新现有记录
      this.logger.log(`[UPSERT] 找到匹配记录，更新记录: ${matchedRecord.recordId}`);
      this.logger.log(`[UPSERT] 字段映射:`, JSON.stringify(finalFieldMapping).substring(0, 200));
      const oldData = { ...(matchedRecord.data || {}) };
      const updatedData = { ...matchedRecord.data, ...finalFieldMapping };
      await this.formDataRepository.update(
        { recordId: matchedRecord.recordId, tenantId: context.tenantId },
        { data: updatedData },
      );
      const changedFields = Object.keys(finalFieldMapping);
      const fieldChanges = this.buildFieldChanges(oldData, updatedData, changedFields);
      if (fieldChanges.length > 0) {
        await this.operationLogService.logOperation(
          context.tenantId,
          String(targetFormId),
          matchedRecord.recordId,
          'update',
          context.userId || 'system',
          `业务规则:${context.ruleName || '未命名规则'}`,
          fieldChanges,
          this.buildRuleDescription(context),
        );
      }
      this.logger.log(`[UPSERT] 记录更新成功`);
    } else {
      // 创建新记录
      this.logger.log(`[UPSERT] 未找到匹配记录，创建新记录`);
      this.logger.log(`[UPSERT] 字段映射:`, JSON.stringify(finalFieldMapping).substring(0, 200));
      await this.formDataService.submit(
        {
          formId: targetFormId,
          data: finalFieldMapping,
        },
        context.userId || 'system',
        `业务规则:${context.ruleName || '未命名规则'}`,
      );
      this.logger.log(`[UPSERT] 记录创建成功`);
    }
  }

  private buildRuleDescription(context: RuleContext): string {
    const ruleName = context.ruleName || context.ruleId || '未命名规则';
    const trigger = context.triggerEvent || 'unknown';
    return `业务规则「${ruleName}」执行（触发事件: ${trigger}，来源表单: ${context.formId}，来源记录: ${context.recordId}）`;
  }

  private buildFieldChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>,
    fieldIds: string[],
  ): Array<{ fieldId: string; oldValue: any; newValue: any; fieldLabel?: string }> {
    return fieldIds
      .filter((fieldId) => JSON.stringify(oldData?.[fieldId]) !== JSON.stringify(newData?.[fieldId]))
      .map((fieldId) => ({
        fieldId,
        oldValue: oldData?.[fieldId],
        newValue: newData?.[fieldId],
      }));
  }

  /**
   * 执行 DELETE(目标表单ID, 条件)
   */
  private async executeDelete(args: string[], context: RuleContext): Promise<void> {
    if (args.length < 2) {
      throw new Error('DELETE 函数至少需要2个参数：目标表单ID和条件');
    }

    const targetFormId = this.resolveValue(args[0], context);
    const condition = args[1];

    const equalIndex = condition.indexOf('=');
    if (equalIndex <= 0) return;
    const leftExpr = condition.substring(0, equalIndex).trim();
    const rightExpr = condition.substring(equalIndex + 1).trim();
    const fieldId = leftExpr.includes('.') ? leftExpr.split('.').pop()!.trim() : leftExpr;
    const rightValue = this.resolveValue(rightExpr, context);

    const matchedRecords = await this.formDataService.findByJsonFieldEquals({
      formId: String(targetFormId),
      tenantId: context.tenantId,
      fieldId,
      value: rightValue,
      take: 500,
    });

    for (const record of matchedRecords) {
      await this.formDataService.remove(record.recordId, context.userId || 'system', `业务规则:${context.ruleName || '未命名规则'}`);
    }
  }

  /**
   * 执行 FOR_EACH(子表字段ID, 函数调用)
   * 遍历子表的每一行，对每行执行函数调用
   * 示例：FOR_EACH(入库明细, UPSERT(库存表, 库存表.产品ID=入库明细.产品ID, 产品ID=入库明细.产品ID, 数量=IFNULL(库存表.数量,0)+入库明细.数量))
   */
  private async executeForEach(args: string[], context: RuleContext): Promise<void> {
    if (args.length < 2) {
      throw new Error('FOR_EACH 函数至少需要2个参数：子表字段ID和函数调用');
    }

    // 解析子表字段ID（可能是字段路径，如 入库表.入库明细）
    const subtableFieldPath = args[0].trim();
    let subtableFieldId = subtableFieldPath;
    
    // 如果包含点号，提取最后的字段ID
    if (subtableFieldPath.includes('.')) {
      const parts = subtableFieldPath.split('.');
      subtableFieldId = parts[parts.length - 1];
    }

    this.logger.log(`[FOR_EACH] 子表字段ID: ${subtableFieldId}`);

    // 获取子表数据
    const subtableData = this.resolveFieldValue(context.data, subtableFieldId);
    if (!Array.isArray(subtableData)) {
      this.logger.warn(`[FOR_EACH] 字段 ${subtableFieldId} 不是数组，无法遍历。实际值:`, subtableData);
      return;
    }

    this.logger.log(`[FOR_EACH] 找到 ${subtableData.length} 行数据`);

    // 重新组合函数调用字符串（处理可能被逗号分割的情况）
    // 注意：这里需要保留原始的函数调用字符串，因为 parseFunctionCalls 会重新解析
    const funcCallStr = args.slice(1).join(',');
    this.logger.log(`[FOR_EACH] 函数调用字符串: ${funcCallStr.substring(0, 200)}`);

    // 先解析一次，确保能正确解析
    const funcCalls = this.parseFunctionCalls(funcCallStr);
    this.logger.log(`[FOR_EACH] 预解析到 ${funcCalls.length} 个函数调用`);

    // 遍历每一行
    for (let rowIndex = 0; rowIndex < subtableData.length; rowIndex++) {
      const row = subtableData[rowIndex];
      this.logger.log(`[FOR_EACH] 处理第 ${rowIndex + 1} 行:`, JSON.stringify(row).substring(0, 100));
      
      // 创建行上下文：当前行的字段可以通过 子表字段ID.字段ID 访问
      // 例如：入库明细.产品ID 会解析为当前行的产品ID
      const rowContext: RuleContext = {
        ...context,
        data: {
          ...context.data,
          [subtableFieldId]: row, // 将当前行作为子表字段的值，这样 入库明细.产品ID 就能解析到 row.产品ID
        },
      };
      for (const funcCall of funcCalls) {
        this.logger.log(`[FOR_EACH] 执行函数: ${funcCall.name}(${funcCall.args.length} 个参数)`);
        this.logger.log(`[FOR_EACH] 参数详情: ${funcCall.args.map((a, i) => `arg${i}=${a.substring(0, 50)}`).join(', ')}`);
        // 在执行函数调用时，字段引用会在 resolveValue -> resolveFieldReference 中解析
        // 例如：入库明细.产品ID 会被解析为 row.产品ID
        await this.executeFunctionCall(funcCall, rowContext);
      }
    }
    
    this.logger.log(`[FOR_EACH] 完成，共处理 ${subtableData.length} 行`);
  }


  /**
   * 评估条件表达式（如 "库存表.产品ID = 入库明细.产品ID"）
   * 注意：leftExpr 中的"表单名.字段ID"应该从 targetData 中解析
   */
  private evaluateCondition(
    condition: string,
    targetData: Record<string, any>,
    context: RuleContext,
  ): boolean {
    // 简单的条件解析：字段ID = 值
    const equalIndex = condition.indexOf('=');
    if (equalIndex <= 0) {
      return false;
    }

    const leftExpr = condition.substring(0, equalIndex).trim();
    const rightExpr = condition.substring(equalIndex + 1).trim();

    // 左侧表达式：如果是"表单名.字段ID"格式，从 targetData 中解析字段ID
    let leftValue: any;
    if (leftExpr.includes('.')) {
      const parts = leftExpr.split('.');
      // 假设格式是：表单名.字段ID，从 targetData 中取字段ID的值
      const fieldId = parts[parts.length - 1];
      leftValue = this.resolveFieldValue(targetData, fieldId);
    } else {
      leftValue = this.resolveFieldValue(targetData, leftExpr);
    }

    // 右侧表达式：从 context.data 中解析（可能是子表字段.字段ID）
    const rightValue = this.resolveValue(rightExpr, context);

    return leftValue == rightValue;
  }

  /**
   * 解析值（支持字段引用、函数调用、字面量、运算符表达式）
   */
  private resolveValue(expr: string, context: RuleContext): any {
    expr = expr.trim();

    // 去除引号
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }

    // 数字
    if (/^-?\d+(\.\d+)?$/.test(expr)) {
      return parseFloat(expr);
    }

    // 布尔值
    if (expr === 'true' || expr === 'TRUE') {
      return true;
    }
    if (expr === 'false' || expr === 'FALSE') {
      return false;
    }

    // 检查是否包含运算符（+、-、*、/），但不包括在引号或括号内的
    // 先检查是否有函数调用（可能包含运算符）
    if (expr.includes('(') && expr.includes(')')) {
      return this.resolveFunctionCall(expr, context);
    }

    // 检查是否有运算符（在函数调用之外）
    // 简单处理：查找不在括号内的运算符
    let operatorIndex = -1;
    let operator = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      
      if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
      } else if (!inQuotes) {
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
        } else if (depth === 0 && (char === '+' || char === '-' || char === '*' || char === '/')) {
          // 找到运算符
          operatorIndex = i;
          operator = char;
          break;
        }
      }
    }
    
    if (operatorIndex > 0) {
      // 有运算符，分别解析左右两边
      const leftExpr = expr.substring(0, operatorIndex).trim();
      const rightExpr = expr.substring(operatorIndex + 1).trim();
      
      const leftValue = this.resolveValue(leftExpr, context);
      const rightValue = this.resolveValue(rightExpr, context);
      
      const leftNum = Number(leftValue) || 0;
      const rightNum = Number(rightValue) || 0;
      
      switch (operator) {
        case '+':
          return leftNum + rightNum;
        case '-':
          return leftNum - rightNum;
        case '*':
          return leftNum * rightNum;
        case '/':
          return rightNum !== 0 ? leftNum / rightNum : 0;
        default:
          return leftValue;
      }
    }

    // 字段引用（如 入库表.入库明细.产品ID）
    if (expr.includes('.')) {
      return this.resolveFieldReference(expr, context);
    }

    // 直接字段ID
    return this.resolveFieldValue(context.data, expr);
  }

  /**
   * 解析字段引用（如 入库表.入库明细.产品ID 或 入库明细.产品ID 或 库存表.数量）
   */
  private resolveFieldReference(expr: string, context: RuleContext): any {
    const parts = expr.split('.');
    
    if (parts.length === 2) {
      // 可能是：表单名.字段ID 或 子表字段ID.字段ID
      const firstPart = parts[0];
      const secondPart = parts[1];
      
      // 先尝试作为子表字段.字段ID（在 FOR_EACH 中，子表字段会被替换为当前行对象）
      const subtableValue = this.resolveFieldValue(context.data, firstPart);
      if (subtableValue && typeof subtableValue === 'object' && !Array.isArray(subtableValue)) {
        // 这是一个对象（当前行），不是数组，说明是在 FOR_EACH 中
        return this.resolveFieldValue(subtableValue, secondPart);
      }
      
      // 如果 firstPart 是表单ID（在 enhancedContext 中，表单ID对应的值是目标记录的数据）
      // 检查 context.data 中是否有以 firstPart 为 key 的对象
      if (context.data[firstPart] && typeof context.data[firstPart] === 'object' && !Array.isArray(context.data[firstPart])) {
        // 这是表单ID.字段ID 格式，从目标记录数据中获取字段值
        return this.resolveFieldValue(context.data[firstPart], secondPart);
      }
      
      // 否则作为普通字段处理：直接查找字段ID
      return this.resolveFieldValue(context.data, secondPart);
    } else if (parts.length === 3) {
      // 表单名.子表字段ID.字段ID（这种情况较少见）
      const subtableData = this.resolveFieldValue(context.data, parts[1]);
      if (Array.isArray(subtableData) && subtableData.length > 0) {
        // 在 FOR_EACH 中，取当前行的值
        const currentRow = subtableData[0];
        return this.resolveFieldValue(currentRow, parts[2]);
      }
      return undefined;
    }
    
    // 单个字段ID
    return this.resolveFieldValue(context.data, parts[0]);
  }

  /**
   * 解析函数调用（如 IFNULL(库存表.数量, 0)）
   * 支持表达式中的函数调用，如 IFNULL(...)+field_xxx
   */
  private resolveFunctionCall(expr: string, context: RuleContext): any {
    // 先尝试匹配最外层的函数调用
    // 例如：IFNULL(form_xxx.field_xxx,0)+field_xxx.subfield_xxx
    // 需要找到第一个函数调用的位置和结束位置
    
    let funcStart = -1;
    let funcName = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';
    
    // 查找函数名和左括号
    for (let i = 0; i < expr.length; i++) {
      const char = expr[i];
      
      if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        }
      } else if (!inQuotes) {
        if (/[\w]/.test(char) && funcStart === -1) {
          // 开始匹配函数名
          funcStart = i;
        } else if (char === '(' && funcStart !== -1) {
          // 找到左括号，提取函数名
          funcName = expr.substring(funcStart, i);
          depth = 1;
          const argsStart = i + 1;
          
          // 查找匹配的右括号
          for (let j = argsStart; j < expr.length; j++) {
            const nextChar = expr[j];
            if (nextChar === '(') {
              depth++;
            } else if (nextChar === ')') {
              depth--;
              if (depth === 0) {
                // 找到匹配的右括号
                const argsStr = expr.substring(argsStart, j);
                const remainingExpr = expr.substring(j + 1).trim();
                
                // 解析函数参数
                const args = this.parseFunctionArgs(argsStr).map((arg) => this.resolveValue(arg, context));
                
                // 执行函数
                let funcResult: any;
                switch (funcName.toUpperCase()) {
                  case 'IFNULL':
                  case 'COALESCE':
                    funcResult = args[0] != null && args[0] !== undefined ? args[0] : args[1] || 0;
                    break;
                  case 'ABS':
                    funcResult = Math.abs(args[0] || 0);
                    break;
                  case 'MAX':
                    funcResult = Math.max(...args);
                    break;
                  case 'MIN':
                    funcResult = Math.min(...args);
                    break;
                  case 'SUM':
                    funcResult = args.reduce((sum, val) => sum + (Number(val) || 0), 0);
                    break;
                  default:
                    this.logger.warn(`未知的函数: ${funcName}`);
                    return expr;
                }
                
                // 如果还有剩余表达式（如 +field_xxx），继续解析
                if (remainingExpr) {
                  // 处理运算符（+、-、*、/）
                  if (remainingExpr.startsWith('+')) {
                    const rightValue = this.resolveValue(remainingExpr.substring(1).trim(), context);
                    return (Number(funcResult) || 0) + (Number(rightValue) || 0);
                  } else if (remainingExpr.startsWith('-')) {
                    const rightValue = this.resolveValue(remainingExpr.substring(1).trim(), context);
                    return (Number(funcResult) || 0) - (Number(rightValue) || 0);
                  } else if (remainingExpr.startsWith('*')) {
                    const rightValue = this.resolveValue(remainingExpr.substring(1).trim(), context);
                    return (Number(funcResult) || 0) * (Number(rightValue) || 0);
                  } else if (remainingExpr.startsWith('/')) {
                    const rightValue = this.resolveValue(remainingExpr.substring(1).trim(), context);
                    return (Number(funcResult) || 0) / (Number(rightValue) || 0);
                  } else {
                    // 没有运算符，直接返回函数结果
                    return funcResult;
                  }
                }
                
                return funcResult;
              }
            }
          }
          
          // 如果没有找到匹配的右括号，返回原表达式
          return expr;
        }
      }
    }
    
    // 如果没有找到函数调用，返回原表达式
    return expr;
  }

  /**
   * 解析字段值（支持嵌套字段，如 data.field1.field2）
   */
  private resolveFieldValue(data: Record<string, any>, fieldPath: string): any {
    if (!data || !fieldPath) {
      return undefined;
    }

    const parts = fieldPath.split('.');
    let value = data;

    const tryResolveKey = (obj: Record<string, any>, rawKey: string): string | undefined => {
      if (!obj || typeof obj !== 'object') return undefined;
      if (rawKey in obj) return rawKey;

      // 兼容历史规则中拼接出来的复合key：xxx-field_xxx-subfield_xxx
      const byDash = String(rawKey).split('-').filter(Boolean);
      for (let i = byDash.length - 1; i >= 0; i--) {
        const token = byDash[i];
        if (token in obj) return token;
      }

      // 再尝试提取 field_/subfield_ 形式的标准字段ID
      const matched = String(rawKey).match(/(subfield_[A-Za-z0-9_]+|field_[A-Za-z0-9_]+)/g);
      if (matched && matched.length > 0) {
        for (let i = matched.length - 1; i >= 0; i--) {
          const token = matched[i];
          if (token in obj) return token;
        }
      }

      return undefined;
    };

    for (const part of parts) {
      if (value == null || typeof value !== 'object') {
        return undefined;
      }
      const resolvedKey = tryResolveKey(value as Record<string, any>, part);
      if (!resolvedKey) return undefined;
      value = value[resolvedKey];
    }

    return value;
  }

  /**
   * 简单模式：创建目标表单记录
   */
  private async createTargetRecord(
    action: BusinessRuleEntity['actions'][0],
    context: RuleContext,
  ): Promise<void> {
    if (!action.targetFormId || !action.fieldMapping) {
      return;
    }

    const fieldMapping: Record<string, any> = {};
    for (const [targetFieldId, sourceExpr] of Object.entries(action.fieldMapping)) {
      fieldMapping[targetFieldId] = this.resolveValue(String(sourceExpr), context);
    }

    await this.formDataService.submit(
      {
        formId: action.targetFormId,
        data: fieldMapping,
      },
      context.userId || 'system',
    );
  }

  /**
   * 简单模式：更新目标表单记录
   */
  private async updateTargetRecord(
    action: BusinessRuleEntity['actions'][0],
    context: RuleContext,
  ): Promise<void> {
    if (!action.targetFormId || !action.fieldMapping) {
      return;
    }

    // 如果有 targetRecordId，直接更新该记录
    if (action.targetRecordId) {
      const record = await this.formDataService.findOne(action.targetRecordId);
      const updatedData: Record<string, unknown> = { ...(record.data || {}) };
      for (const [targetFieldId, sourceExpr] of Object.entries(action.fieldMapping)) {
        updatedData[targetFieldId] = this.resolveValue(String(sourceExpr), context);
      }
      await this.formDataRepository.update(
        { recordId: action.targetRecordId, tenantId: context.tenantId },
        { data: updatedData as any } as any,
      );
      return;
    }

    // 否则需要根据 fieldMapping 中的条件字段查询
    // 这里简化处理：如果有唯一标识字段，可以用它来查询
    this.logger.warn('UPDATE 动作缺少 targetRecordId，需要条件查询功能');
  }

  /**
   * 简单模式：删除目标表单记录
   */
  private async deleteTargetRecord(
    action: BusinessRuleEntity['actions'][0],
    context: RuleContext,
  ): Promise<void> {
    if (!action.targetRecordId) {
      this.logger.warn('DELETE 动作缺少 targetRecordId');
      return;
    }

    await this.formDataService.remove(action.targetRecordId, context.userId || 'system');
  }
}

