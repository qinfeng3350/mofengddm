import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLogEntity } from '../../database/entities/operation-log.entity';

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLogEntity)
    private operationLogRepository: Repository<OperationLogEntity>,
  ) {}

  /**
   * 记录操作日志
   */
  async logOperation(
    tenantId: string,
    formId: string,
    recordId: string,
    operationType: 'create' | 'update' | 'delete',
    operatorId: string,
    operatorName?: string,
    fieldChanges?: Array<{
      fieldId: string;
      fieldLabel?: string;
      oldValue: any;
      newValue: any;
    }>,
    description?: string,
  ): Promise<OperationLogEntity> {
    const log = this.operationLogRepository.create({
      tenantId,
      formId,
      recordId,
      operationType,
      operatorId,
      operatorName,
      fieldChanges,
      description,
    });

    return await this.operationLogRepository.save(log);
  }

  /**
   * 获取表单的操作记录
   */
  async getLogsByForm(
    tenantId: string,
    formId: string,
    limit: number = 100,
  ): Promise<OperationLogEntity[]> {
    return await this.operationLogRepository.find({
      where: { tenantId, formId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 获取记录的操作记录
   */
  async getLogsByRecord(
    tenantId: string,
    formId: string,
    recordId: string,
  ): Promise<OperationLogEntity[]> {
    return await this.operationLogRepository.find({
      where: { tenantId, formId, recordId },
      order: { createdAt: 'DESC' },
    });
  }
}

