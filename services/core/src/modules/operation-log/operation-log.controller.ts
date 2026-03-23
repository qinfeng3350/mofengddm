import { Controller, Get, Query, Request, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLogService } from './operation-log.service';
import { TenantEntity } from '../../database/entities/tenant.entity';

@Controller('api/operation-logs')
// TODO: 实现认证 Guard
// @UseGuards(JwtAuthGuard)
export class OperationLogController {
  constructor(
    private readonly operationLogService: OperationLogService,
    @InjectRepository(TenantEntity)
    private tenantRepository: Repository<TenantEntity>,
  ) {}

  private async getDefaultTenantId(): Promise<string> {
    const tenant = await this.tenantRepository.findOne({
      where: { code: 'default' },
    });
    if (!tenant) {
      throw new Error('默认租户不存在，请先初始化数据库');
    }
    return tenant.id;
  }

  @Get()
  async getLogs(
    @Request() req: any,
    @Query('formId') formId: string,
    @Query('recordId') recordId?: string,
    @Query('limit') limit?: string,
  ) {
    // TODO: 从 JWT token 中获取 tenantId
    const tenantId = await this.getDefaultTenantId();
    
    if (!formId) {
      return [];
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 100;

    if (recordId) {
      return await this.operationLogService.getLogsByRecord(
        tenantId,
        formId,
        recordId,
      );
    }

    return await this.operationLogService.getLogsByForm(
      tenantId,
      formId,
      parsedLimit,
    );
  }
}

