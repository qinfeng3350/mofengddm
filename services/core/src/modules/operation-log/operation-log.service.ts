import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLogEntity } from '../../database/entities/operation-log.entity';
import { RecordCommentEntity } from '../../database/entities/record-comment.entity';
import { UserEntity } from '../../database/entities/user.entity';

@Injectable()
export class OperationLogService {
  constructor(
    @InjectRepository(OperationLogEntity)
    private operationLogRepository: Repository<OperationLogEntity>,
    @InjectRepository(RecordCommentEntity)
    private recordCommentRepository: Repository<RecordCommentEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
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

  async getCommentsByRecord(
    tenantId: string,
    formId: string,
    recordId: string,
  ): Promise<RecordCommentEntity[]> {
    return await this.recordCommentRepository.find({
      where: { tenantId, formId, recordId },
      order: { createdAt: 'ASC' },
    });
  }

  async addComment(
    tenantId: string,
    formId: string,
    recordId: string,
    operatorId: string,
    operatorName: string | undefined,
    content: string,
  ): Promise<RecordCommentEntity> {
    const user = await this.userRepository.findOne({
      where: { id: operatorId as any, tenantId: tenantId as any },
      select: ['id', 'avatar', 'name'],
    });
    const comment = this.recordCommentRepository.create({
      tenantId,
      formId,
      recordId,
      operatorId,
      operatorName: operatorName || user?.name || '未知用户',
      operatorAvatar: user?.avatar || undefined,
      content,
    });
    return await this.recordCommentRepository.save(comment);
  }

  async deleteComment(
    tenantId: string,
    commentId: string,
    operatorId: string,
  ): Promise<boolean> {
    const item = await this.recordCommentRepository.findOne({
      where: { id: commentId as any, tenantId: tenantId as any },
      select: ['id', 'operatorId'],
    });
    if (!item) return false;
    if (String(item.operatorId) !== String(operatorId)) return false;
    const res = await this.recordCommentRepository.delete({ id: commentId as any, tenantId: tenantId as any });
    return (res.affected || 0) > 0;
  }
}

