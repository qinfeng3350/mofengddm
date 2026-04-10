import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseLogService } from './enterprise-log.service';

@Controller('api/enterprise-logs')
@UseGuards(JwtAuthGuard)
export class EnterpriseLogController {
  constructor(private readonly service: EnterpriseLogService) {}

  @Get('stats/daily-operations')
  async statsDailyOperations(@Req() req: any, @Query('days') days?: string) {
    const tenantId = String(req.user?.tenantId || '');
    if (!tenantId) {
      return { days: 30, series: [] as { date: string; count: number }[] };
    }
    const n = days ? parseInt(days, 10) : 30;
    const series = await this.service.statsDailyOperations(tenantId, n);
    return { days: n, series };
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('category') category: 'platform' | 'app' | 'message',
    @Query('subtype') subtype?: string,
    @Query('keyword') keyword?: string,
    @Query('operationType') operationType?: string,
    @Query('triggerType') triggerType?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const tenantId = String(req.user?.tenantId || '');
    if (!tenantId || !category) return { items: [], total: 0 };
    return this.service.list({
      tenantId,
      category,
      subtype,
      keyword,
      operationType,
      triggerType,
      start,
      end,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
    });
  }
}

