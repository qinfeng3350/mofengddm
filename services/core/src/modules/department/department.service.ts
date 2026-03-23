import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentEntity } from '../../database/entities/department.entity';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(DepartmentEntity)
    private readonly departmentRepository: Repository<DepartmentEntity>,
  ) {}

  /**
   * 获取所有部门（树形结构）
   */
  async findAll(tenantId?: string): Promise<DepartmentEntity[]> {
    const queryBuilder = this.departmentRepository.createQueryBuilder('dept');
    
    queryBuilder.where('dept.isActive = :isActive', { isActive: 1 });
    
    if (tenantId) {
      queryBuilder.andWhere('dept.tenantId = :tenantId', { tenantId });
    }
    
    queryBuilder.orderBy('dept.sortOrder', 'ASC');
    queryBuilder.addOrderBy('dept.name', 'ASC');
    
    return queryBuilder.getMany();
  }

  /**
   * 构建部门树形结构
   */
  buildTree(departments: DepartmentEntity[]): any[] {
    const map = new Map<string, any>();
    const roots: any[] = [];

    // 创建所有节点的映射
    departments.forEach((dept) => {
      map.set(dept.id, {
        ...dept,
        title: dept.name,
        key: dept.id,
        children: [],
      });
    });

    // 构建树形结构
    departments.forEach((dept) => {
      const node = map.get(dept.id)!;
      if (dept.parentId && map.has(dept.parentId)) {
        const parent = map.get(dept.parentId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  /**
   * 新建部门（手工）
   */
  async create(payload: {
    tenantId: string;
    name: string;
    parentId?: string;
    sortOrder?: number;
    description?: string;
  }): Promise<DepartmentEntity> {
    const { tenantId, name, parentId, sortOrder, description } = payload;

    // 校验父级是否在同租户
    let parent: DepartmentEntity | null = null;
    if (parentId) {
      parent = await this.departmentRepository.findOne({ where: { id: parentId, tenantId, isActive: 1 } });
      if (!parent) {
        throw new BadRequestException('上级部门不存在或已删除');
      }
    }

    const dept = this.departmentRepository.create() as DepartmentEntity;
    dept.tenantId = tenantId;
    dept.name = name;
    if (parentId) {
      dept.parentId = parentId;
    }
    dept.sortOrder = sortOrder ?? 0;
    dept.description = description;
    dept.isActive = 1;
    dept.metadata = { ...(dept.metadata || {}), source: 'manual' };

    return this.departmentRepository.save(dept);
  }

  /**
   * 更新部门（禁止修改钉钉同步的部门）
   */
  async update(
    id: string,
    tenantId: string,
    payload: Partial<Pick<DepartmentEntity, 'name' | 'parentId' | 'sortOrder' | 'description'>>,
  ): Promise<DepartmentEntity> {
    const dept = await this.departmentRepository.findOne({ where: { id, tenantId } });
    if (!dept || dept.isActive !== 1) {
      throw new BadRequestException('部门不存在或已删除');
    }

    // 只读：钉钉同步的部门不可编辑
    const isDingtalk =
      (dept.code && dept.code.startsWith('dingtalk')) ||
      (dept.metadata && (dept.metadata as any)?.source === 'dingtalk');
    if (isDingtalk) {
      throw new BadRequestException('钉钉同步的部门不可修改');
    }

    if (payload.parentId) {
      const parent = await this.departmentRepository.findOne({
        where: { id: payload.parentId, tenantId, isActive: 1 },
      });
      if (!parent) {
        throw new BadRequestException('上级部门不存在或已删除');
      }
    }

    Object.assign(dept, {
      name: payload.name ?? dept.name,
      parentId: payload.parentId ?? dept.parentId,
      sortOrder: payload.sortOrder ?? dept.sortOrder,
      description: payload.description ?? dept.description,
    });

    return this.departmentRepository.save(dept);
  }

  /**
   * 软删除部门（禁止删除钉钉同步的部门）
   */
  async softDelete(id: string, tenantId: string): Promise<void> {
    const dept = await this.departmentRepository.findOne({ where: { id, tenantId } });
    if (!dept || dept.isActive !== 1) {
      throw new BadRequestException('部门不存在或已删除');
    }

    const isDingtalk =
      (dept.code && dept.code.startsWith('dingtalk')) ||
      (dept.metadata && (dept.metadata as any)?.source === 'dingtalk');
    if (isDingtalk) {
      throw new BadRequestException('钉钉同步的部门不可删除');
    }

    dept.isActive = 0;
    await this.departmentRepository.save(dept);
  }
}

