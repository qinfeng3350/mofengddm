import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LoginLogService } from './login-log.service';

@Controller('api/login-logs')
@UseGuards(JwtAuthGuard)
export class LoginLogController {
  constructor(private readonly loginLogService: LoginLogService) {}

  @Get('stats/daily-users')
  async statsDailyUsers(@Request() req: any, @Query('days') days?: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { days: 30, series: [] as { date: string; count: number }[] };
    }
    const n = days ? parseInt(days, 10) : 30;
    const series = await this.loginLogService.statsDailyUniqueUsers(
      String(tenantId),
      n,
    );
    return { days: n, series };
  }

  @Get()
  async list(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('userId') userId?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { items: [], total: 0 };
    }
    return this.loginLogService.list({
      tenantId: String(tenantId),
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 10,
      keyword,
      userId,
      start,
      end,
    });
  }
}
