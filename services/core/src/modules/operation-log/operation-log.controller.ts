import { Controller, Get, Query, Request, UseGuards, UnauthorizedException } from '@nestjs/common';
import { OperationLogService } from './operation-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/operation-logs')
@UseGuards(JwtAuthGuard)
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get()
  async getLogs(
    @Request() req: any,
    @Query('formId') formId: string,
    @Query('recordId') recordId?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('无法确定租户，请重新登录');
    }
    
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
      String(tenantId),
      formId,
      parsedLimit,
    );
  }
}

