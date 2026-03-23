import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { DingtalkService } from './dingtalk.service';
import { UserEntity, DepartmentEntity, TenantEntity } from '../../database/entities';
import type { DingtalkDepartment, DingtalkUser } from './types/dingtalk.types';

@Injectable()
export class DingtalkSyncService {
  constructor(
    private readonly dingtalkService: DingtalkService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departmentRepository: Repository<DepartmentEntity>,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 同步钉钉组织架构（部门和用户）
   */
  async syncOrganization(
    appKey: string,
    appSecret: string,
  ): Promise<{
    departments: { total: number; created: number; updated: number; errors: any[] };
    users: { total: number; created: number; updated: number; errors: any[] };
  }> {
    const results: {
      departments: { total: number; created: number; updated: number; errors: any[] };
      users: { total: number; created: number; updated: number; errors: any[] };
    } = {
      departments: { total: 0, created: 0, updated: 0, errors: [] },
      users: { total: 0, created: 0, updated: 0, errors: [] },
    };

    // 部门映射：钉钉部门ID -> 系统部门ID
    const deptIdMap = new Map<string, string>();

    // 步骤1: 获取钉钉部门列表，找到根部门（公司）并创建/获取租户
    let tenant: TenantEntity | null = null;
    try {
      const dingTalkDepartments = await this.dingtalkService.getAllDepartments(
        appKey,
        appSecret,
      );

      console.log(
        '[DingtalkSync] 部门列表(前20个):',
        dingTalkDepartments
          .slice(0, 20)
          .map((d) => `id=${d.dept_id}, parent=${d.parent_id}, name=${d.name}`)
          .join(' | '),
      );
      
      // 找到根部门：优先 parent_id 为 0/1，且名称包含“公司”或“有限”
      let companyName = '默认租户';
      const rootCandidates = dingTalkDepartments.filter(
        (dept) => !dept.parent_id || dept.parent_id === 0 || dept.parent_id === 1,
      );

      const preferredRoot =
        rootCandidates.find((d) => d.name?.includes('公司') || d.name?.includes('有限')) ||
        // 次优：名称长度最长的候选
        rootCandidates.sort((a, b) => (b.name || '').length - (a.name || '').length)[0] ||
        // 兜底：列表的第一个
        dingTalkDepartments[0];

      if (preferredRoot?.name) {
        companyName = preferredRoot.name;
      }

      console.log(
        `[DingtalkSync] 识别到公司名称: ${companyName} (候选数量: ${rootCandidates.length})`,
      );

      // 根据公司名称创建或获取租户
      let existingTenant = await this.tenantRepository.findOne({
        where: { name: companyName },
      });

      if (!existingTenant) {
        // 如果不存在，创建新租户
        const tenantCode = `dingtalk_${Date.now()}`;
        existingTenant = this.tenantRepository.create({
          code: tenantCode,
          name: companyName,
          status: 1,
          metadata: {
            source: 'dingtalk',
            syncedAt: new Date().toISOString(),
          },
        });
        tenant = await this.tenantRepository.save(existingTenant);
      } else {
        // 更新租户元数据
        existingTenant.metadata = {
          ...(existingTenant.metadata || {}),
          source: 'dingtalk',
          syncedAt: new Date().toISOString(),
        };
        tenant = await this.tenantRepository.save(existingTenant);
      }
      
      // 确保租户已创建
      if (!tenant) {
        throw new Error('无法创建或获取租户');
      }
      
      console.log(`[DingtalkSync] 租户信息: ID=${tenant.id}, Name=${tenant.name}, Code=${tenant.code}`);
      
      results.departments.total = dingTalkDepartments.length;

      if (dingTalkDepartments.length > 0) {
        // 按层级排序：先处理父部门
        const sortedDepts = this.sortDepartmentsByHierarchy(dingTalkDepartments);

        for (const dtDept of sortedDepts) {
          try {
            if (!dtDept.dept_id) continue;

            const dingTalkDeptId = String(dtDept.dept_id);
            const deptCode = `dingtalk_${dingTalkDeptId}`;

            if (!tenant) {
              throw new Error('租户未初始化');
            }
            
            let systemDept = await this.departmentRepository.findOne({
              where: { code: deptCode },
            });

            // 处理父部门
            let parentId: string | undefined = undefined;
            if (dtDept.parent_id && dtDept.parent_id !== 1 && dtDept.parent_id !== 0) {
              const parentDingTalkId = String(dtDept.parent_id);
              const parentSystemId = deptIdMap.get(parentDingTalkId);
              if (parentSystemId) {
                parentId = parentSystemId;
              } else {
                const parentCode = `dingtalk_${parentDingTalkId}`;
                const parentDept = await this.departmentRepository.findOne({
                  where: { code: parentCode },
                });
                if (parentDept) {
                  parentId = parentDept.id;
                  deptIdMap.set(parentDingTalkId, parentDept.id);
                }
              }
            }

            if (!systemDept) {
              systemDept = this.departmentRepository.create({
                name: dtDept.name || `部门_${dingTalkDeptId}`,
                code: deptCode,
                parentId,
                tenantId: tenant.id,
                description: '',
                sortOrder: dtDept.order || 0,
                isActive: 1,
              });
              await this.departmentRepository.save(systemDept);
              results.departments.created++;
            } else {
              systemDept.name = dtDept.name || systemDept.name;
              systemDept.parentId = parentId !== undefined ? parentId : systemDept.parentId;
              systemDept.sortOrder = dtDept.order !== undefined ? dtDept.order : systemDept.sortOrder;
              systemDept.tenantId = tenant.id; // 确保租户ID正确
              await this.departmentRepository.save(systemDept);
              results.departments.updated++;
            }

            deptIdMap.set(dingTalkDeptId, systemDept.id);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`同步部门失败 [${dtDept.dept_id}] ${dtDept.name}:`, errorMessage);
            results.departments.errors.push({
              deptId: dtDept.dept_id,
              name: dtDept.name || '未知',
              error: errorMessage,
            });
          }
        }
      }
    } catch (error) {
      results.departments.errors.push({
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 如果租户创建失败，无法继续同步用户
    if (!tenant) {
      throw new HttpException(
        '无法创建或获取租户，同步失败',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // 步骤2: 同步用户
    try {
      const dingTalkUsers = await this.dingtalkService.getAllUsers(appKey, appSecret);
      results.users.total = dingTalkUsers.length;

      // 默认密码哈希
      const defaultPassword = '123456';
      const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

      for (const dtUser of dingTalkUsers) {
        try {
          if (!dtUser || !dtUser.userid) {
            continue;
          }

          // 查找现有用户（通过钉钉用户ID或手机号）
          let systemUser = await this.userRepository.findOne({
            where: { account: `dingtalk_${dtUser.userid}` },
          });

          // 如果通过账号没找到，尝试通过手机号查找（不限定租户，避免重复账号）
          if (!systemUser && dtUser.mobile) {
            systemUser = await this.userRepository.findOne({
              where: { phone: dtUser.mobile },
            });
          }

          // 确定部门
          let departmentId: string | undefined = undefined;
          if (dtUser.dept_id_list && dtUser.dept_id_list.length > 0) {
            const firstDeptId = String(dtUser.dept_id_list[0]);
            departmentId = deptIdMap.get(firstDeptId);
          }

          if (!systemUser) {
            // 创建新用户
            const newUser = this.userRepository.create({
              account: `dingtalk_${dtUser.userid}`,
              name: dtUser.name || `钉钉用户_${dtUser.userid}`,
              email: dtUser.email || `${dtUser.userid}@dingtalk.local`,
              phone: dtUser.mobile || null,
              passwordHash: defaultPasswordHash,
              tenantId: tenant.id,
              status: 1,
              avatar: dtUser.avatar || null,
              position: dtUser.position || null,
              jobNumber: dtUser.jobnumber || null,
              departmentId,
              metadata: {
                dingtalkUserId: dtUser.userid,
                syncedAt: new Date().toISOString(),
              },
            } as Partial<UserEntity>);
            systemUser = await this.userRepository.save(newUser);
            results.users.created++;
          } else {
            // 更新现有用户
            systemUser.name = dtUser.name || systemUser.name;
            systemUser.phone = dtUser.mobile || systemUser.phone;
            systemUser.email = dtUser.email || systemUser.email;
            systemUser.avatar = dtUser.avatar || systemUser.avatar;
            systemUser.position = dtUser.position || systemUser.position;
            systemUser.jobNumber = dtUser.jobnumber || systemUser.jobNumber;
            systemUser.departmentId = departmentId || systemUser.departmentId;
            systemUser.tenantId = tenant.id; // 确保租户ID正确
            systemUser.metadata = {
              ...(systemUser.metadata || {}),
              dingtalkUserId: dtUser.userid,
              syncedAt: new Date().toISOString(),
            };
            await this.userRepository.save(systemUser);
            results.users.updated++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`同步用户失败 [${dtUser.userid}] ${dtUser.name}:`, errorMessage);
          results.users.errors.push({
            userId: dtUser.userid,
            name: dtUser.name || '未知',
            error: errorMessage,
          });
        }
      }
    } catch (error) {
      results.users.errors.push({
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return results;
  }

  /**
   * 按层级排序部门（先处理父部门）
   */
  private sortDepartmentsByHierarchy(
    departments: DingtalkDepartment[],
  ): DingtalkDepartment[] {
    const deptMap = new Map<number, DingtalkDepartment>();
    departments.forEach((dept) => {
      if (dept.dept_id) {
        deptMap.set(dept.dept_id, dept);
      }
    });

    const sorted: DingtalkDepartment[] = [];
    const processed = new Set<number>();

    const processDept = (deptId: number) => {
      if (processed.has(deptId)) return;
      const dept = deptMap.get(deptId);
      if (!dept) return;

      if (dept.parent_id && dept.parent_id !== 1 && dept.parent_id !== 0) {
        processDept(dept.parent_id);
      }

      sorted.push(dept);
      processed.add(deptId);
    };

    departments.forEach((dept) => {
      if (dept.dept_id) {
        processDept(dept.dept_id);
      }
    });

    return sorted;
  }
}

