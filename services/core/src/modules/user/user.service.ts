import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findAll(tenantId?: string): Promise<UserEntity[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    queryBuilder.where('user.status = :status', { status: 1 });
    
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

  async search(keyword: string, tenantId?: string): Promise<UserEntity[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');
    
    queryBuilder.where('user.status = :status', { status: 1 });
    
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
        'department.id',
        'department.name',
      ])
      .orderBy('user.name', 'ASC');
    
    return queryBuilder.getMany();
  }
}

