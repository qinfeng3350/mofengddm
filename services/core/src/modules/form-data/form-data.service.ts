import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormDataEntity } from '../../database/entities/form-data.entity';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { SubmitFormDataDto } from './dto/submit-form-data.dto';
import { BusinessRuleExecutorService } from '../business-rule/business-rule.executor';
import { OperationLogService } from '../operation-log/operation-log.service';

@Injectable()
export class FormDataService {
  constructor(
    @InjectRepository(FormDataEntity)
    private formDataRepository: Repository<FormDataEntity>,
    @InjectRepository(FormDefinitionEntity)
    private formDefinitionRepository: Repository<FormDefinitionEntity>,
    @Inject(forwardRef(() => BusinessRuleExecutorService))
    private ruleExecutor: BusinessRuleExecutorService,
    private operationLogService: OperationLogService,
  ) {}

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

    // 如果提供了 recordId，说明是编辑模式，调用 update 方法
    if (submitDto.recordId) {
      return this.update(submitDto.recordId, submitDto, userId, userName);
    }

    // 创建表单数据记录
    // TypeORM的json类型会自动序列化，直接传入对象即可
    const formData = this.formDataRepository.create({
      formId: submitDto.formId,
      tenantId,
      recordId: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: submitDto.data, // TypeORM会自动处理JSON序列化
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

    return saved;
  }

  async update(
    recordId: string,
    updateDto: Partial<SubmitFormDataDto>,
    userId: string,
    userName?: string,
  ): Promise<FormDataEntity> {
    const existingRecord = await this.findOne(recordId);
    const tenantId = existingRecord.tenantId;
    const oldData = { ...existingRecord.data };

    // 更新数据
    const updatedData = updateDto.data || existingRecord.data;
    Object.assign(existingRecord, {
      data: updatedData,
      submitterId: userId,
      submitterName: userName,
      status: updateDto.status ?? existingRecord.status,
    });

    const saved = await this.formDataRepository.save(existingRecord);

    // 计算字段变更
    const formDefinition = await this.formDefinitionRepository.findOne({
      where: { formId: existingRecord.formId },
    });

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

    return saved;
  }

  async findAll(formId: string): Promise<FormDataEntity[]> {
    const fd = await this.formDefinitionRepository.findOne({ where: { formId } });
    if (!fd) {
      throw new NotFoundException(`表单定义 ${formId} 不存在`);
    }
    return await this.formDataRepository.find({
      where: { formId, tenantId: fd.tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(recordId: string): Promise<FormDataEntity> {
    const formData = await this.formDataRepository.findOne({
      where: { recordId },
    });

    if (!formData) {
      throw new NotFoundException(`表单数据 ${recordId} 不存在`);
    }

    // TypeORM的json类型会自动反序列化，直接返回即可
    return formData;
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
