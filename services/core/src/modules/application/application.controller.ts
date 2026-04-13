import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleService } from '../role/role.service';

@UseGuards(JwtAuthGuard)
@Controller('api/applications')
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly roleService: RoleService,
  ) {}

  @Post()
  async create(@Body() createDto: CreateApplicationDto, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    const userId = req.user?.userId || req.user?.id || 'default-user';
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    return this.applicationService.create(createDto, tenantId, userId);
  }

  @Get()
  async findAll(@Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    return this.applicationService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    return this.applicationService.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateApplicationDto>,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    const userId = req.user?.userId || req.user?.id || 'default-user';
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    return this.applicationService.update(id, updateDto, tenantId, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    const userId = req.user?.userId || req.user?.id || 'default-user';
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    return this.applicationService.remove(id, tenantId, userId);
  }
}

