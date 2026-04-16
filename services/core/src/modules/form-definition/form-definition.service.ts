import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { CreateFormDefinitionDto } from './dto/create-form-definition.dto';
import { TenantLimitsService } from '../tenant-metrics/tenant-limits.service';
import { EnterpriseLogService } from '../enterprise-log/enterprise-log.service';

@Injectable()
export class FormDefinitionService {
  constructor(
    @InjectRepository(FormDefinitionEntity)
    private formDefinitionRepository: Repository<FormDefinitionEntity>,
    private readonly tenantLimitsService: TenantLimitsService,
    private readonly enterpriseLogService: EnterpriseLogService,
  ) {}

  private parseConfig(raw: any): any {
    if (!raw) return {};
    if (typeof raw === 'string') {
      // 历史坏数据：TEXT 列被错误写入对象，MySQL 会存成 "[object Object]"
      if (raw.trim() === '[object Object]') {
        return {};
      }
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') return raw;
    return {};
  }

  private ensureStringConfig(configObj: any): string {
    try {
      return JSON.stringify(configObj ?? {});
    } catch {
      return JSON.stringify({});
    }
  }

  async create(
    createDto: CreateFormDefinitionDto,
    tenantId: string,
    applicationId: string,
    userId: string,
  ): Promise<FormDefinitionEntity> {
    // 配额约束：检查 maxForms
    await this.tenantLimitsService.assertCanCreateForm(tenantId);

    const layout = createDto.layout
      ? {
          type: createDto.layout.type,
          columns: createDto.layout.columns,
        }
      : { type: 'grid', columns: 12 };

    const formDefinition = this.formDefinitionRepository.create({
      formId: `form_${Date.now()}`,
      formName: createDto.formName,
      category: createDto.category,
      tenantId,
      applicationId,
      createdBy: userId,
      version: 1,
      status: createDto.status || 'draft',
      config: JSON.stringify({
        fields: createDto.fields,
        layout: layout,
        metadata: (createDto as any).metadata || {},
        // 如果提供了elements，也包含进去
        ...((createDto as any).elements ? { elements: (createDto as any).elements } : {}),
      }),
      layout: layout as Record<string, unknown>,
    });

    const saved = await this.formDefinitionRepository.save(formDefinition);
    await this.enterpriseLogService.log({
      tenantId,
      category: 'app',
      subtype: 'app',
      operatorId: userId,
      operationType: '创建数据表',
      relatedApp: String(applicationId),
      relatedObject: saved.formName,
      detail: `创建了数据表【${saved.formName}】`,
      ip: '127.0.0.1',
    });
    return saved;
  }

  async findAll(tenantId: string, applicationId?: string): Promise<FormDefinitionEntity[]> {
    const where: any = { tenantId };
    if (applicationId) {
      where.applicationId = applicationId;
    }
    const formDefinitions = await this.formDefinitionRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
    
    return formDefinitions.map(fd => {
      const parsed = this.parseConfig(fd.config);
      (fd as any).config = Object.keys(parsed).length
        ? parsed
        : { fields: [], layout: { type: 'grid', columns: 12 }, metadata: {} };
      if (!(fd as any).config.metadata) (fd as any).config.metadata = {};
      return fd;
    });
  }

  async findOne(
    formId: string,
    tenantId: string,
  ): Promise<FormDefinitionEntity> {
    const formDefinition = await this.formDefinitionRepository.findOne({
      where: { formId, tenantId },
    });

    if (!formDefinition) {
      throw new NotFoundException(`表单定义 ${formId} 不存在`);
    }

    const parsed = this.parseConfig(formDefinition.config);
    formDefinition.config = Object.keys(parsed).length
      ? parsed
      : { fields: [], layout: { type: 'grid', columns: 12 }, metadata: {} };
    if (!(formDefinition.config as any).metadata) (formDefinition.config as any).metadata = {};

    return formDefinition;
  }

  // 外链填单场景：按 formId 公开读取表单定义（不要求登录）
  async findOnePublic(formId: string): Promise<FormDefinitionEntity> {
    const formDefinition = await this.formDefinitionRepository.findOne({
      where: { formId },
    });

    if (!formDefinition) {
      throw new NotFoundException(`表单定义 ${formId} 不存在`);
    }

    const parsed = this.parseConfig(formDefinition.config);
    formDefinition.config = Object.keys(parsed).length
      ? parsed
      : { fields: [], layout: { type: 'grid', columns: 12 }, metadata: {} };
    if (!(formDefinition.config as any).metadata) (formDefinition.config as any).metadata = {};

    return formDefinition;
  }

  async update(
    formId: string,
    updateDto: Partial<CreateFormDefinitionDto>,
    tenantId: string,
    userId: string,
  ): Promise<FormDefinitionEntity> {
    const formDefinition = await this.findOne(formId, tenantId);

    const layout = updateDto.layout
      ? ({
          type: updateDto.layout.type,
          columns: updateDto.layout.columns,
        } as Record<string, unknown>)
      : formDefinition.layout;

    const existingConfig = this.parseConfig(formDefinition.config);
    const metadata = (updateDto as any).metadata || existingConfig.metadata || {};
    const elements = (updateDto as any).elements || existingConfig.elements;
    const fields = updateDto.fields || existingConfig.fields || [];
    const configData: any = {
      fields,
      layout: layout || existingConfig.layout || { type: 'grid', columns: 12 },
      metadata,
    };
    if (elements) configData.elements = elements;
    const updatedConfig = this.ensureStringConfig(configData);

    Object.assign(formDefinition, {
      formName: updateDto.formName ?? formDefinition.formName,
      category: updateDto.category ?? formDefinition.category,
      status: updateDto.status ?? formDefinition.status,
      updatedBy: userId,
      version: formDefinition.version + 1,
      config: updatedConfig,
      layout: layout,
    });

    const saved = await this.formDefinitionRepository.save(formDefinition);
    await this.enterpriseLogService.log({
      tenantId,
      category: 'app',
      subtype: 'app',
      operatorId: userId,
      operationType: '修改数据表',
      relatedApp: String(saved.applicationId || ''),
      relatedObject: saved.formName,
      detail: `修改了数据表【${saved.formName}】`,
      ip: '127.0.0.1',
    });
    return saved;
  }

  async remove(formId: string, tenantId: string, userId?: string): Promise<void> {
    const formDefinition = await this.findOne(formId, tenantId);
    await this.formDefinitionRepository.remove(formDefinition);
    await this.enterpriseLogService.log({
      tenantId,
      category: 'app',
      subtype: 'app',
      operatorId: userId,
      operationType: '删除数据表',
      relatedApp: String(formDefinition.applicationId || ''),
      relatedObject: formDefinition.formName,
      detail: `删除了数据表【${formDefinition.formName}】`,
      ip: '127.0.0.1',
    });
  }
}
