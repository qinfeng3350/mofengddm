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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationService } from './application.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/applications')
export class ApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    @InjectRepository(TenantEntity)
    private tenantRepository: Repository<TenantEntity>,
  ) {}

  private async getDefaultTenantId(): Promise<string> {
    const tenant = await this.tenantRepository.findOne({
      where: { code: 'default' },
    });
    if (!tenant) {
      throw new Error('Default tenant not found');
    }
    return tenant.id;
  }

  @Post()
  async create(@Body() createDto: CreateApplicationDto, @Req() req: any) {
    const tenantId = req.user?.tenantId || (await this.getDefaultTenantId());
    const userId = req.user?.userId || 'default-user';
    return this.applicationService.create(createDto, tenantId, userId);
  }

  @Get()
  async findAll(@Req() req: any) {
    const tenantId = req.user?.tenantId || (await this.getDefaultTenantId());
    return this.applicationService.findAll(tenantId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId || (await this.getDefaultTenantId());
    return this.applicationService.findOne(id, tenantId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateApplicationDto>,
    @Req() req: any,
  ) {
    const tenantId = req.user?.tenantId || (await this.getDefaultTenantId());
    return this.applicationService.update(id, updateDto, tenantId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user?.tenantId || (await this.getDefaultTenantId());
    return this.applicationService.remove(id, tenantId);
  }
}

