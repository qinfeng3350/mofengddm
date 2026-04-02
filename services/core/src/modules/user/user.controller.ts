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
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
  constructor(private readonly userService: UserService) {}

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

