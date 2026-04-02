import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { TenantLimitsService } from '../tenant-metrics/tenant-limits.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly tenantLimits: TenantLimitsService,
  ) {}

  async findAll(tenantId?: string, includeDisabled = false): Promise<UserEntity[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (!includeDisabled) {
      queryBuilder.where('user.status = :status', { status: 1 });
    }

    if (tenantId) {
      queryBuilder.andWhere('user.tenantId = :tenantId', { tenantId });
    }
    
    queryBuilder
      .leftJoinAndSelect('user.department', 'department')
      .select([
        'user.id',
        'user.account',
        'user.name',
        'user.email',
        'user.phone',
        'user.avatar',
        'user.position',
        'user.jobNumber',
        'user.departmentId',
        'user.tenantId',
        'user.status',
        'department.id',
        'department.name',
      ])
      .orderBy('user.name', 'ASC');
    
    return queryBuilder.getMany();
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['department'],
      select: [
        'id',
        'account',
        'name',
        'email',
        'phone',
        'avatar',
        'position',
        'jobNumber',
        'departmentId',
        'tenantId',
      ],
    });
  }

  async search(
    keyword: string,
    tenantId?: string,
    includeDisabled = false,
  ): Promise<UserEntity[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (!includeDisabled) {
      queryBuilder.where('user.status = :status', { status: 1 });
    }

    if (tenantId) {
      queryBuilder.andWhere('user.tenantId = :tenantId', { tenantId });
    }
    
    queryBuilder.andWhere(
      '(user.name LIKE :keyword OR user.account LIKE :keyword OR user.email LIKE :keyword OR user.phone LIKE :keyword)',
      { keyword: `%${keyword}%` }
    );
    
    queryBuilder
      .leftJoinAndSelect('user.department', 'department')
      .select([
        'user.id',
        'user.account',
        'user.name',
        'user.email',
        'user.phone',
        'user.avatar',
        'user.position',
        'user.jobNumber',
        'user.departmentId',
        'user.tenantId',
        'user.status',
        'department.id',
        'department.name',
      ])
      .orderBy('user.name', 'ASC');
    
    return queryBuilder.getMany();
  }

  async setStatusForTenant(
    userId: string,
    tenantId: string,
    status: number,
  ): Promise<UserEntity> {
    if (status !== 0 && status !== 1) {
      throw new BadRequestException('status 只能为 0（停用）或 1（启用）');
    }
    const user = await this.userRepository.findOne({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    if (status === 1) {
      await this.tenantLimits.assertCanEnableUser(tenantId, user.status);
    }
    user.status = status;
    return this.userRepository.save(user);
  }
}

