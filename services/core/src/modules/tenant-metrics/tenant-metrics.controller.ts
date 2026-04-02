import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FormDataEntity,
  FormDefinitionEntity,
  UserEntity,
} from '../../database/entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantLimitsService } from './tenant-limits.service';

@Controller('api/tenants/me')
@UseGuards(JwtAuthGuard)
export class TenantMetricsController {
  constructor(
    @InjectRepository(FormDefinitionEntity)
    private readonly formDefinitionRepo: Repository<FormDefinitionEntity>,
    @InjectRepository(FormDataEntity)
    private readonly formDataRepo: Repository<FormDataEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  @Get('metrics')
  async getMetrics(@Request() req: any) {
    const tenantId = String(req.user?.tenantId || '');
    if (!tenantId) {
      return { success: false, message: '无法确定租户，请重新登录' };
    }

    const [formsCount, recordsCount, enabledUsersCount] = await Promise.all([
      this.formDefinitionRepo.count({ where: { tenantId } }),
      this.formDataRepo.count({ where: { tenantId } }),
      this.userRepo.count({ where: { tenantId, status: 1 } }),
    ]);

    return {
      success: true,
      data: {
        formsCount,
        recordsCount,
        enabledUsersCount,
      },
    };
  }

  /**
   * 当前租户配额与实时用量（metadata.limits + 计数）
   */
  @Get('limits')
  async getLimits(@Request() req: any) {
    const tenantId = String(req.user?.tenantId || '');
    if (!tenantId) {
      return { success: false, message: '无法确定租户，请重新登录' };
    }
    const snapshot = await this.tenantLimitsService.getLimitsSnapshot(tenantId);
    return { success: true, data: snapshot };
  }
}
