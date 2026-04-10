import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationEntity } from '../../database/entities/application.entity';
import { CreateApplicationDto } from './dto/create-application.dto';
import { EnterpriseLogService } from '../enterprise-log/enterprise-log.service';

@Injectable()
export class ApplicationService {
  constructor(
    @InjectRepository(ApplicationEntity)
    private applicationRepository: Repository<ApplicationEntity>,
    private readonly enterpriseLogService: EnterpriseLogService,
  ) {}

  async create(createDto: CreateApplicationDto, tenantId: string, userId: string) {
    // 检查code是否已存在
    const existing = await this.applicationRepository.findOne({
      where: { tenantId, code: createDto.code },
    });

    if (existing) {
      throw new Error(`应用代码 ${createDto.code} 已存在`);
    }

    const application = this.applicationRepository.create({
      ...createDto,
      tenantId,
      metadata: createDto.metadata ? JSON.stringify(createDto.metadata) : undefined,
    });

    const saved = await this.applicationRepository.save(application);
    await this.enterpriseLogService.log({
      tenantId,
      category: 'app',
      subtype: 'app',
      operatorId: userId,
      operationType: '创建应用',
      relatedApp: createDto.name,
      relatedObject: createDto.code,
      detail: `创建了应用【${createDto.name}】`,
      ip: '127.0.0.1',
    });
    
    // 解析metadata字段返回
    return {
      ...saved,
      metadata: saved.metadata ? (typeof saved.metadata === 'string' ? JSON.parse(saved.metadata) : saved.metadata) : {},
    };
  }

  async findAll(tenantId: string) {
    const applications = await this.applicationRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    
    // 解析metadata字段
    return applications.map(app => ({
      ...app,
      metadata: app.metadata ? (typeof app.metadata === 'string' ? JSON.parse(app.metadata) : app.metadata) : {},
    }));
  }

  async findOne(id: string, tenantId: string) {
    const application = await this.applicationRepository.findOne({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException(`应用 ${id} 不存在`);
    }

    // 解析metadata字段
    return {
      ...application,
      metadata: application.metadata ? (typeof application.metadata === 'string' ? JSON.parse(application.metadata) : application.metadata) : {},
    };
  }

  async update(
    id: string,
    updateDto: Partial<CreateApplicationDto>,
    tenantId: string,
    userId?: string,
  ) {
    const application = await this.applicationRepository.findOne({
      where: { id, tenantId },
    });

    if (!application) {
      throw new NotFoundException(`应用 ${id} 不存在`);
    }

    // 处理metadata字段
    if (updateDto.metadata !== undefined) {
      application.metadata = JSON.stringify(updateDto.metadata);
    }
    
    // 处理其他字段
    if (updateDto.name !== undefined) {
      application.name = updateDto.name;
    }
    if (updateDto.code !== undefined) {
      application.code = updateDto.code;
    }
    if (updateDto.status !== undefined) {
      application.status = updateDto.status;
    }

    const saved = await this.applicationRepository.save(application);
    await this.enterpriseLogService.log({
      tenantId,
      category: 'app',
      subtype: 'app',
      operatorId: userId,
      operationType: '修改应用',
      relatedApp: saved.name,
      relatedObject: saved.code,
      detail: `修改了应用【${saved.name}】`,
      ip: '127.0.0.1',
    });
    
    // 解析metadata字段返回
    return {
      ...saved,
      metadata: saved.metadata ? (typeof saved.metadata === 'string' ? JSON.parse(saved.metadata) : saved.metadata) : {},
    };
  }

  async remove(id: string, tenantId: string, userId?: string) {
    const application = await this.findOne(id, tenantId);
    await this.applicationRepository.remove(application);
    await this.enterpriseLogService.log({
      tenantId,
      category: 'app',
      subtype: 'app',
      operatorId: userId,
      operationType: '删除应用',
      relatedApp: application.name,
      relatedObject: application.code,
      detail: `删除了应用【${application.name}】`,
      ip: '127.0.0.1',
    });
    return { message: '应用删除成功' };
  }
}

