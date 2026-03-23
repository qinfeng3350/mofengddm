import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { CreateFormDefinitionDto } from './dto/create-form-definition.dto';

@Injectable()
export class FormDefinitionService {
  constructor(
    @InjectRepository(FormDefinitionEntity)
    private formDefinitionRepository: Repository<FormDefinitionEntity>,
  ) {}

  async create(
    createDto: CreateFormDefinitionDto,
    tenantId: string,
    applicationId: string,
    userId: string,
  ): Promise<FormDefinitionEntity> {
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

    return await this.formDefinitionRepository.save(formDefinition);
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
    
    // 解析 config JSON 字符串
    return formDefinitions.map(fd => {
      if (typeof fd.config === 'string') {
        try {
          const parsedConfig = JSON.parse(fd.config);
          (fd as any).config = parsedConfig;
        } catch (e) {
          console.error('解析 config JSON 失败:', e);
          (fd as any).config = { fields: [], layout: { type: 'grid', columns: 12 } };
        }
      }
      if (!(fd as any).config.metadata) {
        (fd as any).config.metadata = {};
      }
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

    // 确保 config 字段被正确解析为对象
    // TypeORM 的 TEXT 类型不会自动解析 JSON，需要手动处理
    if (typeof formDefinition.config === 'string') {
      try {
        formDefinition.config = JSON.parse(formDefinition.config);
      } catch (e) {
        console.error('解析 config JSON 失败:', e);
        // 如果解析失败，设置为空对象
        formDefinition.config = { fields: [], layout: { type: 'grid', columns: 12 } };
      }
    }

    if (!(formDefinition.config as any).metadata) {
      (formDefinition.config as any).metadata = {};
    }

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

    // 处理config更新，保留metadata
    // 解析现有config以保留metadata
    let existingConfig: any = {};
    if (typeof formDefinition.config === 'string') {
      try {
        existingConfig = JSON.parse(formDefinition.config);
      } catch (e) {
        existingConfig = {};
      }
    } else {
      existingConfig = formDefinition.config;
    }
    
    // 如果提供了fields，更新整个config（包括metadata和elements）
    let updatedConfig = formDefinition.config;
    if (updateDto.fields) {
      // 检查前端是否在config中传递了metadata或elements（通过特殊字段）
      // 或者从existingConfig中保留metadata和elements
      const metadata = (updateDto as any).metadata || existingConfig.metadata || {};
      const elements = (updateDto as any).elements || existingConfig.elements;
      const configData: any = {
        fields: updateDto.fields,
        layout: layout,
        metadata: metadata,
      };
      // 如果存在elements，也包含进去
      if (elements) {
        configData.elements = elements;
      }
      updatedConfig = JSON.stringify(configData);
    }

    Object.assign(formDefinition, {
      formName: updateDto.formName ?? formDefinition.formName,
      category: updateDto.category ?? formDefinition.category,
      status: updateDto.status ?? formDefinition.status,
      updatedBy: userId,
      version: formDefinition.version + 1,
      config: updatedConfig,
      layout: layout,
    });

    return await this.formDefinitionRepository.save(formDefinition);
  }

  async remove(formId: string, tenantId: string): Promise<void> {
    const formDefinition = await this.findOne(formId, tenantId);
    await this.formDefinitionRepository.remove(formDefinition);
  }
}
