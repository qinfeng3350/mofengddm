import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { DingtalkService } from './dingtalk.service';
import { UserEntity, DepartmentEntity, TenantEntity } from '../../database/entities';
import type { DingtalkDepartment, DingtalkUser } from './types/dingtalk.types';
import { TenantLimitsService } from '../tenant-metrics/tenant-limits.service';

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
    private readonly tenantLimitsService: TenantLimitsService,
  ) {}

  /**
   * 同步钉钉组织架构（部门和用户）
   */
  async syncOrganization(
    appKey: string,
    appSecret: string,
    agentId?: string,
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
      const parseTenantMetadata = (value: unknown): Record<string, unknown> => {
        if (!value) return {};
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return {};
          }
        }
        if (typeof value === 'object') return value as Record<string, unknown>;
        return {};
      };

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
            dingtalk: {
              appKey,
              appSecret,
              agentId: agentId || undefined,
            },
          },
        });
        tenant = await this.tenantRepository.save(existingTenant);
        const savedMeta = parseTenantMetadata(tenant.metadata);
        const savedDing = (savedMeta as any)?.dingtalk;
        console.log('[DingtalkSync] 创建租户写入 metadata.dingtalk', {
          tenantId: tenant.id,
          hasAppKey: !!savedDing?.appKey,
          hasAppSecret: !!savedDing?.appSecret,
          hasAgentId: !!savedDing?.agentId,
        });
      } else {
        // 更新租户元数据
        const prevMeta = parseTenantMetadata(existingTenant.metadata);
        existingTenant.metadata = {
          ...prevMeta,
          source: 'dingtalk',
          syncedAt: new Date().toISOString(),
          dingtalk: {
            ...(prevMeta as any)?.dingtalk,
            appKey,
            appSecret,
            ...(agentId ? { agentId } : {}),
          },
        };
        tenant = await this.tenantRepository.save(existingTenant);
        const savedMeta = parseTenantMetadata(tenant.metadata);
        const savedDing = (savedMeta as any)?.dingtalk;
        console.log('[DingtalkSync] 更新租户写入 metadata.dingtalk', {
          tenantId: tenant.id,
          hasAppKey: !!savedDing?.appKey,
          hasAppSecret: !!savedDing?.appSecret,
          hasAgentId: !!savedDing?.agentId,
        });
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
            if (dtDept.parent_id && dtDept.parent_id !== 0) {
              const parentDingTalkId = String(dtDept.parent_id);
              // 子部门 parent_id=1 时，应挂到公司主体（dingtalk_1），不能保持空父级
              if (parentDingTalkId === dingTalkDeptId) {
                parentId = undefined;
              } else {
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

          // 兜底：lists 接口有时不会带 manager_userid / is_admin / is_boss
          // 缺失时补拉 user/get，保证「发起人直属上级」可解析出具体领导
          let mergedUser: DingtalkUser = dtUser;

          // 查找现有用户（通过钉钉用户ID或手机号）
          let systemUser = await this.userRepository.findOne({
            where: { account: `dingtalk_${dtUser.userid}` },
          });

          // 如果通过账号没找到，尝试通过手机号查找（必须限定当前租户，避免跨租户串数据）
          if (!systemUser && dtUser.mobile) {
            systemUser = await this.userRepository.findOne({
              where: { phone: dtUser.mobile, tenantId: tenant.id },
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
            const needUserDetail =
              !(dtUser as DingtalkUser).manager_userid &&
              (dtUser as DingtalkUser).is_admin == null &&
              (dtUser as DingtalkUser).is_boss == null;
            if (needUserDetail) {
              try {
                const detail = await this.dingtalkService.getUserById(appKey, appSecret, String(dtUser.userid));
                if (detail) mergedUser = { ...dtUser, ...detail };
              } catch (e) {
                // ignore: 不阻塞整个同步
              }
            }

            const unionId =
              (mergedUser as any).unionid || (mergedUser as any).unionId || undefined;
            const managerUserId = mergedUser.manager_userid
              ? String(mergedUser.manager_userid)
              : undefined;
            const isAdmin =
              mergedUser.is_admin === true ||
              (mergedUser as any).isAdmin === true ||
              (mergedUser as any).admin === true;
            const isBoss =
              mergedUser.is_boss === true ||
              (mergedUser as any).isBoss === true ||
              (mergedUser as any).boss === true;
            const isLeader = isAdmin || isBoss;
            const deptIds = Array.isArray(mergedUser.dept_id_list)
              ? mergedUser.dept_id_list.map((x) => String(x))
              : [];
            const leaderInDept = Array.isArray((mergedUser as any).leader_in_dept)
              ? (mergedUser as any).leader_in_dept.map((x: any) => {
                  const deptId = String(x?.dept_id ?? '');
                  const deptSystemId = deptId ? deptIdMap.get(deptId) : undefined;
                  return {
                    deptId,
                    ...(deptSystemId ? { deptSystemId } : {}),
                    leader: Boolean(x?.leader),
                  };
                })
              : [];
            // 重新确认部门（兜底：如果列表接口没带 dept_id_list，但 user/get 带了，就用新信息覆盖）
            if (deptIds.length) {
              const mapped = deptIdMap.get(deptIds[0]);
              if (mapped) departmentId = mapped;
            }
            if (unionId && Math.random() < 0.02) {
              const head = String(unionId).slice(0, 4);
              const tail = String(unionId).slice(-4);
              console.log('[DingtalkSync] 检测到 unionId', { userid: dtUser.userid, unionIdHead: head, unionIdTail: tail });
            }
            await this.tenantLimitsService.assertCanEnableUser(tenant.id, 0);
            const newUser = this.userRepository.create({
              account: `dingtalk_${dtUser.userid}`,
              name: mergedUser.name || `钉钉用户_${dtUser.userid}`,
              email: mergedUser.email || `${dtUser.userid}@dingtalk.local`,
              phone: mergedUser.mobile || null,
              passwordHash: defaultPasswordHash,
              tenantId: tenant.id,
              status: 1,
              avatar: mergedUser.avatar || null,
              position: mergedUser.position || null,
              jobNumber: mergedUser.jobnumber || null,
              departmentId,
              metadata: {
                dingtalkUserId: dtUser.userid,
                dingtalkUnionId: unionId,
                ...(managerUserId ? { dingtalkManagerUserId: managerUserId } : {}),
                ...(managerUserId ? { managerUserId, leaderUserId: managerUserId } : {}),
                isLeader,
                isAdmin,
                isBoss,
                ...(leaderInDept.length ? { dingtalkLeaderInDept: leaderInDept } : {}),
                ...(deptIds.length
                  ? {
                      dingtalkDeptIds: deptIds,
                      departmentIds: deptIds,
                      deptIds,
                      dingtalkDeptId: deptIds[0],
                    }
                  : {}),
                syncedAt: new Date().toISOString(),
              },
            } as Partial<UserEntity>);
            systemUser = await this.userRepository.save(newUser);
            results.users.created++;
          } else {
            const parseUserMetadata = (value: unknown): Record<string, unknown> => {
              if (!value) return {};
              if (typeof value === 'string') {
                try {
                  return JSON.parse(value);
                } catch {
                  return {};
                }
              }
              if (typeof value === 'object') return value as Record<string, unknown>;
              return {};
            };

            const needUserDetail =
              !(dtUser as DingtalkUser).manager_userid &&
              (dtUser as DingtalkUser).is_admin == null &&
              (dtUser as DingtalkUser).is_boss == null;
            if (needUserDetail) {
              try {
                const detail = await this.dingtalkService.getUserById(appKey, appSecret, String(dtUser.userid));
                if (detail) mergedUser = { ...dtUser, ...detail };
              } catch (e) {
                // ignore
              }
            }

            // 更新现有用户
            systemUser.name = mergedUser.name || systemUser.name;
            systemUser.phone = mergedUser.mobile || systemUser.phone;
            systemUser.email = mergedUser.email || systemUser.email;
            systemUser.avatar = mergedUser.avatar || systemUser.avatar;
            systemUser.position = mergedUser.position || systemUser.position;
            systemUser.jobNumber = mergedUser.jobnumber || systemUser.jobNumber;
            const deptIds = Array.isArray(mergedUser.dept_id_list)
              ? mergedUser.dept_id_list.map((x) => String(x))
              : [];
            if (deptIds.length) {
              const mapped = deptIdMap.get(deptIds[0]);
              systemUser.departmentId = mapped || departmentId || systemUser.departmentId;
            } else {
              systemUser.departmentId = departmentId || systemUser.departmentId;
            }
            systemUser.tenantId = tenant.id; // 确保租户ID正确
            const mgr = mergedUser.manager_userid ? String(mergedUser.manager_userid) : undefined;
            const isAdmin =
              mergedUser.is_admin === true ||
              (mergedUser as any).isAdmin === true ||
              (mergedUser as any).admin === true;
            const isBoss =
              mergedUser.is_boss === true ||
              (mergedUser as any).isBoss === true ||
              (mergedUser as any).boss === true;
            const isLeader = isAdmin || isBoss;
            const leaderInDept = Array.isArray((mergedUser as any).leader_in_dept)
              ? (mergedUser as any).leader_in_dept.map((x: any) => {
                  const deptId = String(x?.dept_id ?? '');
                  const deptSystemId = deptId ? deptIdMap.get(deptId) : undefined;
                  return {
                    deptId,
                    ...(deptSystemId ? { deptSystemId } : {}),
                    leader: Boolean(x?.leader),
                  };
                })
              : [];
            systemUser.metadata = {
              ...parseUserMetadata(systemUser.metadata),
              dingtalkUserId: dtUser.userid,
              dingtalkUnionId:
                (mergedUser as any).unionid || (mergedUser as any).unionId || (systemUser.metadata as any)?.dingtalkUnionId,
              ...(mgr ? { dingtalkManagerUserId: mgr } : {}),
              ...(mgr ? { managerUserId: mgr, leaderUserId: mgr } : {}),
              isLeader,
              isAdmin,
              isBoss,
              ...(leaderInDept.length ? { dingtalkLeaderInDept: leaderInDept } : {}),
              ...(deptIds.length
                ? {
                    dingtalkDeptIds: deptIds,
                    departmentIds: deptIds,
                    deptIds,
                    dingtalkDeptId: deptIds[0],
                  }
                : {}),
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

