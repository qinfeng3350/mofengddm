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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormDefinitionService } from '../form-definition/form-definition.service';
import { CreateFormDefinitionDto } from '../form-definition/dto/create-form-definition.dto';
import { ApplicationEntity } from '../../database/entities/application.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleService } from '../role/role.service';

@UseGuards(JwtAuthGuard)
@Controller('api/applications/:appId/forms')
export class ApplicationFormsController {
  constructor(
    private readonly formDefinitionService: FormDefinitionService,
    @InjectRepository(ApplicationEntity)
    private applicationRepository: Repository<ApplicationEntity>,
    private readonly roleService: RoleService,
  ) {}

  @Post()
  async create(
    @Param('appId') appId: string,
    @Body() createDto: CreateFormDefinitionDto,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    const userId = req.user?.userId || req.user?.id || 'default-user';
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });

    // 验证应用是否存在
    const application = await this.applicationRepository.findOne({
      where: { id: appId, tenantId },
    });
    if (!application) {
      throw new Error('应用不存在');
    }
    
    return this.formDefinitionService.create(createDto, tenantId, appId, userId);
  }

  @Get()
  async findAll(@Param('appId') appId: string, @Req() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    return this.formDefinitionService.findAll(tenantId, appId);
  }

  @Get(':formId')
  async findOne(
    @Param('appId') appId: string,
    @Param('formId') formId: string,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    return this.formDefinitionService.findOne(formId, tenantId);
  }

  @Patch(':formId')
  async update(
    @Param('appId') appId: string,
    @Param('formId') formId: string,
    @Body() updateDto: Partial<CreateFormDefinitionDto>,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    const userId = req.user?.userId || req.user?.id || 'default-user';
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    return this.formDefinitionService.update(formId, updateDto, tenantId, userId);
  }

  @Delete(':formId')
  async remove(
    @Param('appId') appId: string,
    @Param('formId') formId: string,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('无法确定租户，请重新登录');
    const userId = req.user?.userId || req.user?.id || 'default-user';
    await this.roleService.assertSystemAdmin({ tenantId: String(tenantId), userId: String(userId) });
    return this.formDefinitionService.remove(formId, tenantId, userId);
  }
}

