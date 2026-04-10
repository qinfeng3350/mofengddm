import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RoleEntity } from '../../database/entities/role.entity';
import { UserRoleEntity } from '../../database/entities/user-role.entity';
import { UserEntity } from '../../database/entities/user.entity';

const SYS_ADMIN_CODE = 'sys_admin';
const SYS_ADMIN_NAME = '系统管理员';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async ensureSystemAdminRole(tenantId: string): Promise<RoleEntity> {
    const exist = await this.roleRepo.findOne({
      where: { tenantId, code: SYS_ADMIN_CODE } as any,
    });
    if (exist) return exist;
    const role = this.roleRepo.create({
      tenantId,
      code: SYS_ADMIN_CODE,
      name: SYS_ADMIN_NAME,
      status: 1,
      permissions: {},
    } as any);
    const saved = await this.roleRepo.save(role as any);
    return Array.isArray(saved) ? (saved[0] as any) : (saved as any);
  }

  async isSystemAdmin(params: { tenantId: string; userId: string }): Promise<boolean> {
    const { tenantId, userId } = params;
    if (!tenantId || !userId) return false;
    const row = await this.userRoleRepo
      .createQueryBuilder('ur')
      .leftJoin(RoleEntity, 'r', 'r.id = ur.roleId')
      .where('ur.userId = :userId', { userId })
      .andWhere('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.code = :code', { code: SYS_ADMIN_CODE })
      .select(['ur.id as id'])
      .limit(1)
      .getRawOne();
    return !!row?.id;
  }

  async assertSystemAdmin(params: { tenantId: string; userId: string }): Promise<void> {
    const ok = await this.isSystemAdmin(params);
    if (!ok) {
      throw new ForbiddenException('无权限：仅系统管理员可执行该操作');
    }
  }

  async getSystemAdminUserIds(tenantId: string): Promise<string[]> {
    if (!tenantId) return [];
    const role = await this.ensureSystemAdminRole(tenantId);
    const rows = await this.userRoleRepo.find({
      where: { roleId: String(role.id) } as any,
    });
    return rows.map((r) => String(r.userId)).filter(Boolean);
  }

  async setSystemAdminUserIds(params: { tenantId: string; userIds: string[] }): Promise<string[]> {
    const { tenantId } = params;
    const userIds = Array.from(new Set((params.userIds || []).map((x) => String(x)).filter(Boolean)));
    const role = await this.ensureSystemAdminRole(tenantId);

    // 仅允许设置当前租户下存在的用户
    const validUsers = userIds.length
      ? await this.userRepo.find({
          where: { tenantId, id: In(userIds) } as any,
          select: ['id'] as any,
        })
      : [];
    const validIds = new Set(validUsers.map((u) => String(u.id)));
    const finalIds = userIds.filter((id) => validIds.has(String(id)));

    // 清空旧绑定，再写入新绑定
    await this.userRoleRepo.delete({ roleId: String(role.id) } as any);
    if (finalIds.length) {
      const rows = finalIds.map((uid) =>
        this.userRoleRepo.create({
          userId: String(uid),
          roleId: String(role.id),
        } as any),
      );
      await this.userRoleRepo.save(rows as any);
    }
    return finalIds;
  }
}

