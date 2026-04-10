import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleEntity } from '../../database/entities/role.entity';
import { RoleService } from './role.service';

@Controller('api/roles')
@UseGuards(JwtAuthGuard)
export class RoleController {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    private readonly roleService: RoleService,
  ) {}

  @Get()
  async list(@Request() req: any) {
    const tenantId = String(req.user?.tenantId ?? '');
    if (!tenantId) return [];
    const roles = await this.roleRepo.find({
      where: { tenantId } as any,
      order: { updatedAt: 'DESC' } as any,
    });
    return roles.map((r) => ({
      id: String(r.id),
      code: r.code,
      name: r.name,
      status: r.status,
    }));
  }

  @Get('system-admins')
  async getSystemAdmins(@Request() req: any) {
    const tenantId = String(req.user?.tenantId ?? '');
    if (!tenantId) return { userIds: [] as string[] };
    const userIds = await this.roleService.getSystemAdminUserIds(tenantId);
    return { userIds };
  }

  @Put('system-admins')
  async setSystemAdmins(@Request() req: any, @Body() body: { userIds?: string[] }) {
    const tenantId = String(req.user?.tenantId ?? '');
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    if (!tenantId) return { userIds: [] as string[] };

    // 初始化：若当前租户尚无系统管理员，允许任意登录用户设置首批管理员（避免鸡生蛋问题）
    const existing = await this.roleService.getSystemAdminUserIds(tenantId);
    if (existing.length > 0) {
      // 只有现任系统管理员允许修改系统管理员名单
      await this.roleService.assertSystemAdmin({ tenantId, userId });
    }

    const next = await this.roleService.setSystemAdminUserIds({
      tenantId,
      userIds: Array.isArray(body?.userIds) ? body.userIds : [],
    });
    return { userIds: next };
  }
}

