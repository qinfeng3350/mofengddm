import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRoleEntity } from '../../database/entities/user-role.entity';
import { RoleEntity } from '../../database/entities/role.entity';

function mapUser(user: {
  id: string;
  name: string;
  account: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  position?: string | null;
  jobNumber?: string | null;
  departmentId?: string | null;
  tenantId?: string | null;
  status: number;
  department?: { id: string; name: string } | null;
}) {
  return {
    id: user.id,
    name: user.name,
    account: user.account,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    position: user.position,
    jobNumber: user.jobNumber,
    departmentId: user.departmentId,
    department: user.department
      ? { id: user.department.id, name: user.department.name }
      : null,
    tenantId: user.tenantId,
    status: user.status,
  };
}

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  @Get()
  async getUsers(
    @Query('keyword') keyword?: string,
    @Query('includeDisabled') includeDisabled?: string,
    @Request() req?: any,
  ) {
    const tenantId = req.user?.tenantId;
    const all = includeDisabled === '1' || includeDisabled === 'true';

    if (keyword) {
      const users = await this.userService.search(keyword, tenantId, all);
      return users.map(mapUser);
    }

    const users = await this.userService.findAll(tenantId, all);
    return users.map(mapUser);
  }

  @Get('me/roles')
  async getMyRoles(@Request() req: any) {
    const userId = String(req.user?.id ?? req.user?.userId ?? '');
    const tenantId = String(req.user?.tenantId ?? '');
    if (!userId || !tenantId) return [];

    const rows = await this.userRoleRepo
      .createQueryBuilder('ur')
      .leftJoin(RoleEntity, 'r', 'r.id = ur.roleId')
      .where('ur.userId = :userId', { userId })
      .andWhere('r.tenantId = :tenantId', { tenantId })
      .select(['ur.roleId as id', 'r.code as code', 'r.name as name'])
      .getRawMany();

    return rows.map((x: any) => ({
      id: String(x.id),
      code: x.code,
      name: x.name,
    }));
  }

  @Patch(':id/status')
  async setUserStatus(
    @Param('id') id: string,
    @Body() body: { status?: number },
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    const updated = await this.userService.setStatusForTenant(
      id,
      tenantId,
      body?.status ?? -1,
    );
    return mapUser({
      ...updated,
      department: null,
    });
  }
}

