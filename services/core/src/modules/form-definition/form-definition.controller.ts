import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormDefinitionService } from './form-definition.service';
import { CreateFormDefinitionDto } from './dto/create-form-definition.dto';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { ApplicationEntity } from '../../database/entities/application.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleService } from '../role/role.service';

@Controller('api/form-definitions')
@UseGuards(JwtAuthGuard)
export class FormDefinitionController {
  constructor(
    private readonly formDefinitionService: FormDefinitionService,
    @InjectRepository(TenantEntity)
    private tenantRepository: Repository<TenantEntity>,
    @InjectRepository(ApplicationEntity)
    private applicationRepository: Repository<ApplicationEntity>,
    private readonly roleService: RoleService,
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

  private resolveTenantAndUser(req: any, defaultTenantId?: string) {
    const tenantId = req?.user?.tenantId || defaultTenantId;
    const userId = req?.user?.userId || req?.user?.id || 'default-user';
    if (!tenantId) {
      throw new UnauthorizedException('无法确定租户，请重新登录');
    }
    return { tenantId, userId };
  }

  @Post()
  async create(
    @Body() createDto: CreateFormDefinitionDto & { applicationId?: string },
    @Request() req: any,
  ) {
    const { tenantId, userId } = this.resolveTenantAndUser(req, await this.getDefaultTenantId());
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    
    // 如果没有提供applicationId，获取默认应用
    let applicationId = createDto.applicationId;
    if (!applicationId) {
      const defaultApp = await this.applicationRepository.findOne({
        where: { tenantId, code: `default-app-${tenantId}` },
      });
      if (!defaultApp) {
        throw new Error('默认应用不存在，请先创建应用');
      }
      applicationId = defaultApp.id;
    }
    
    if (!applicationId) {
      throw new Error('无法确定应用ID');
    }
    
    return this.formDefinitionService.create(createDto, tenantId, applicationId, userId);
  }

  @Get()
  async findAll(@Request() req: any) {
    const { tenantId } = this.resolveTenantAndUser(req, await this.getDefaultTenantId());
    return this.formDefinitionService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const { tenantId } = this.resolveTenantAndUser(req, await this.getDefaultTenantId());
    return this.formDefinitionService.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateFormDefinitionDto>,
    @Request() req: any,
  ) {
    const { tenantId, userId } = this.resolveTenantAndUser(req, await this.getDefaultTenantId());
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    return this.formDefinitionService.update(id, updateDto, tenantId, userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    const { tenantId, userId } = this.resolveTenantAndUser(req, await this.getDefaultTenantId());
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    return this.formDefinitionService.remove(id, tenantId, userId);
  }
}
