import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessRuleEntity } from '../../database/entities/business-rule.entity';
import { BusinessRuleExecutionLogEntity } from '../../database/entities/business-rule-execution-log.entity';
import { CreateBusinessRuleDto, UpdateBusinessRuleDto } from './dto/create-business-rule.dto';

@Injectable()
export class BusinessRuleService {
  constructor(
    @InjectRepository(BusinessRuleEntity)
    private businessRuleRepository: Repository<BusinessRuleEntity>,
    @InjectRepository(BusinessRuleExecutionLogEntity)
    private executionLogRepository: Repository<BusinessRuleExecutionLogEntity>,
  ) {}

  async create(
    createDto: CreateBusinessRuleDto,
    tenantId: string,
    userId?: string,
  ): Promise<BusinessRuleEntity> {
    const rule = this.businessRuleRepository.create({
      ruleId: createDto.ruleId,
      ruleName: createDto.ruleName,
      description: createDto.description,
      enabled: createDto.enabled ?? true,
      priority: createDto.priority ?? 0,
      tenantId,
      applicationId: createDto.applicationId,
      createdBy: userId,
      trigger: createDto.trigger,
      actions: createDto.actions,
      metadata: createDto.metadata,
    });

    return await this.businessRuleRepository.save(rule);
  }

  async findAll(tenantId: string, applicationId?: string): Promise<BusinessRuleEntity[]> {
    const where: any = { tenantId };
    if (applicationId) {
      where.applicationId = applicationId;
    }
    return await this.businessRuleRepository.find({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(ruleId: string, tenantId: string): Promise<BusinessRuleEntity> {
    const rule = await this.businessRuleRepository.findOne({
      where: { ruleId, tenantId },
    });

    if (!rule) {
      throw new NotFoundException(`规则 ${ruleId} 不存在`);
    }

    return rule;
  }

  async update(
    ruleId: string,
    updateDto: UpdateBusinessRuleDto,
    tenantId: string,
    userId?: string,
  ): Promise<BusinessRuleEntity> {
    const rule = await this.findOne(ruleId, tenantId);

    Object.assign(rule, {
      ...updateDto,
      updatedBy: userId,
    });

    return await this.businessRuleRepository.save(rule);
  }

  async remove(ruleId: string, tenantId: string): Promise<void> {
    const rule = await this.findOne(ruleId, tenantId);
    await this.businessRuleRepository.remove(rule);
  }

  async toggleEnabled(ruleId: string, enabled: boolean, tenantId: string): Promise<BusinessRuleEntity> {
    const rule = await this.findOne(ruleId, tenantId);
    rule.enabled = enabled;
    return await this.businessRuleRepository.save(rule);
  }

  async listExecutionLogs(
    tenantId: string,
    params: { applicationId?: string; formId?: string; ruleId?: string; limit?: number },
  ): Promise<BusinessRuleExecutionLogEntity[]> {
    const where: Record<string, unknown> = { tenantId };
    if (params.applicationId) where.applicationId = params.applicationId;
    if (params.formId) where.formId = params.formId;
    if (params.ruleId) where.ruleId = params.ruleId;
    const take = Math.min(Math.max(params.limit || 50, 1), 200);

    return await this.executionLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take,
    });
  }
}

