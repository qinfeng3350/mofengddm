import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type {
  DingtalkAccessTokenResponse,
  DingtalkDepartment,
  DingtalkDepartmentResponse,
  DingtalkUser,
  DingtalkUserResponse,
} from './types/dingtalk.types';

@Injectable()
export class DingtalkService {
  private readonly baseUrl = 'https://oapi.dingtalk.com';
  private readonly todoV1BaseUrl = 'https://api.dingtalk.com';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * OAuth2：使用 code 换取 userAccessToken（网页扫码 / H5 免登通用）
   * POST https://api.dingtalk.com/v1.0/oauth2/userAccessToken
   */
  async exchangeOAuthUserAccessToken(options: {
    clientId: string;
    clientSecret: string;
    code: string;
  }): Promise<{ accessToken: string; expireIn: number; refreshToken?: string }> {
    const url = `${this.todoV1BaseUrl}/v1.0/oauth2/userAccessToken`;
    const body = {
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      code: options.code,
      grantType: 'authorization_code',
    };

    try {
      const resp = await firstValueFrom(this.httpService.post(url, body));
      const data = resp.data || {};
      if (!data.accessToken) {
        throw new HttpException(
          `钉钉换取 userAccessToken 失败: ${data.message || 'unknown'}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return {
        accessToken: String(data.accessToken),
        expireIn: Number(data.expireIn || 0),
        refreshToken: data.refreshToken ? String(data.refreshToken) : undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `钉钉换取 userAccessToken 失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * OAuth2：获取当前用户信息
   * GET https://api.dingtalk.com/v1.0/contact/users/me
   * header: x-acs-dingtalk-access-token = userAccessToken
   */
  async getOAuthUserInfo(options: {
    userAccessToken: string;
  }): Promise<{ unionId?: string; openId?: string; nick?: string; avatarUrl?: string }> {
    const url = `${this.todoV1BaseUrl}/v1.0/contact/users/me`;
    try {
      const resp = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'x-acs-dingtalk-access-token': options.userAccessToken,
          },
        }),
      );
      const data = resp.data || {};
      return {
        unionId: data.unionId ? String(data.unionId) : undefined,
        openId: data.openId ? String(data.openId) : undefined,
        nick: data.nick ? String(data.nick) : undefined,
        avatarUrl: data.avatarUrl ? String(data.avatarUrl) : undefined,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        `钉钉获取用户信息失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取钉钉访问令牌
   */
  async getAccessToken(appKey: string, appSecret: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<DingtalkAccessTokenResponse>(
          `${this.baseUrl}/gettoken`,
          {
            params: {
              appkey: appKey,
              appsecret: appSecret,
            },
          },
        ),
      );

      if (response.data.errcode !== 0 || !response.data.access_token) {
        throw new HttpException(
          `获取钉钉访问令牌失败: ${response.data.errmsg}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data.access_token;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取钉钉访问令牌失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取钉钉部门列表（子部门）
   */
  async getDepartments(
    appKey: string,
    appSecret: string,
    deptId?: number,
  ): Promise<DingtalkDepartment[]> {
    try {
      const accessToken = await this.getAccessToken(appKey, appSecret);

      // 使用 POST 方法，参数放在 body 中
      const body: any = {};
      if (deptId) {
        body.dept_id = deptId;
      }

      const response = await firstValueFrom(
        this.httpService.post<DingtalkDepartmentResponse>(
          `${this.baseUrl}/topapi/v2/department/listsub`,
          body,
          {
            params: {
              access_token: accessToken,
            },
          },
        ),
      );

      if (response.data.errcode !== 0) {
        throw new HttpException(
          `获取钉钉部门列表失败: ${response.data.errmsg} (错误码: ${response.data.errcode})`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 注意：listsub API 返回的是 result 字段，不是 department
      const departments = (response.data.result || response.data.department || []).map(
        (dept: any) => ({
          dept_id: dept.dept_id || dept.id,
          id: dept.id || dept.dept_id,
          name: dept.name || `部门_${dept.dept_id || dept.id}`,
          parent_id: dept.parent_id || 0,
          order: dept.order || 0,
        }),
      );
      console.log(
        `[DingtalkService] 获取子部门 dept_id=${deptId || 1} 返回数量: ${departments.length}`,
      );
      return departments;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取钉钉部门列表失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取所有部门（使用多种方法，确保获取所有部门）
   */
  async getAllDepartments(
    appKey: string,
    appSecret: string,
  ): Promise<DingtalkDepartment[]> {
    try {
      const allDepartments: DingtalkDepartment[] = [];
      const processedDeptIds = new Set<number>(); // 防止重复处理

      // 先获取根部门（dept_id = 1），保证公司级部门在列表中
      try {
        const rootDept = await this.getDepartment(appKey, appSecret, 1);
        if (rootDept) {
          allDepartments.push(rootDept);
          processedDeptIds.add(rootDept.dept_id);
        }
      } catch (err) {
        // 根部门获取失败不阻塞后续流程
        console.warn('[DingtalkService] 获取根部门失败，继续递归获取子部门', err?.message);
      }

      // 递归获取所有子部门
      await this.fetchSubDepartments(
        appKey,
        appSecret,
        1,
        allDepartments,
        processedDeptIds,
        0,
        20,
      );

      return allDepartments;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取所有部门失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 递归获取子部门
   */
  private async fetchSubDepartments(
    appKey: string,
    appSecret: string,
    deptId: number,
    allDepartments: DingtalkDepartment[],
    processedDeptIds: Set<number>,
    currentDepth: number = 0,
    maxDepth: number = 10,
  ): Promise<void> {
    // 限制递归深度，避免超时
    if (currentDepth >= maxDepth) {
      return;
    }
    
    try {
      const subDepartments = await this.getDepartments(appKey, appSecret, deptId);
      if (subDepartments.length > 0) {
        // 只添加未处理的部门
        subDepartments.forEach((dept) => {
          if (!processedDeptIds.has(dept.dept_id)) {
            allDepartments.push(dept);
            processedDeptIds.add(dept.dept_id);
          }
        });
        
        // 继续递归获取子部门
        for (const dept of subDepartments) {
          await this.fetchSubDepartments(
            appKey,
            appSecret,
            dept.dept_id,
            allDepartments,
            processedDeptIds,
            currentDepth + 1,
            maxDepth,
          );
        }
      }
    } catch (error) {
      // 忽略单个部门的错误，继续获取其他部门
      console.warn(`获取部门 ${deptId} 的子部门失败:`, error.message);
    }
  }

  /**
   * 获取钉钉用户列表
   */
  async getUsers(
    appKey: string,
    appSecret: string,
    deptId?: number,
    cursor?: number,
    size: number = 100,
  ): Promise<{ users: DingtalkUser[]; hasMore: boolean; nextCursor?: number }> {
    try {
      const accessToken = await this.getAccessToken(appKey, appSecret);

      const response = await firstValueFrom(
        this.httpService.post<DingtalkUserResponse>(
          `${this.baseUrl}/topapi/v2/user/list`,
          {
            dept_id: deptId || 1,
            cursor: cursor || 0,
            size,
          },
          {
            params: {
              access_token: accessToken,
            },
          },
        ),
      );

      if (response.data.errcode !== 0) {
        throw new HttpException(
          `获取钉钉用户列表失败: ${response.data.errmsg} (错误码: ${response.data.errcode})`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // v2 API 返回格式：result.list 或 result.userlist
      const result = response.data.result || {};
      const users = result.list || result.userlist || response.data.userlist || [];
      const hasMore = result.hasMore || response.data.hasMore || false;
      const nextCursor = hasMore ? (result.nextCursor || (cursor || 0) + users.length) : undefined;

      return {
        users,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取钉钉用户列表失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取所有用户（分页获取）
   */
  async getAllUsers(
    appKey: string,
    appSecret: string,
    deptId?: number,
  ): Promise<DingtalkUser[]> {
    try {
      const allUsers: DingtalkUser[] = [];
      const processedUserIds = new Set<string>(); // 防止重复
      
      // 如果不指定部门，先获取所有部门，然后获取每个部门的用户
      if (!deptId) {
        const departments = await this.getAllDepartments(appKey, appSecret);
        
        // 如果没有任何部门，尝试获取根部门的用户
        if (departments.length === 0) {
          let cursor: number | undefined = 0;
          let hasMore = true;
          let maxIterations = 100; // 防止无限循环
          
          while (hasMore && cursor !== undefined && maxIterations > 0) {
            const result = await this.getUsers(appKey, appSecret, 1, cursor);
            result.users.forEach((user) => {
              if (!processedUserIds.has(user.userid)) {
                allUsers.push(user);
                processedUserIds.add(user.userid);
              }
            });
            hasMore = result.hasMore;
            cursor = result.nextCursor;
            maxIterations--;
          }
        } else {
          // 获取每个部门的用户
          console.log(`开始遍历 ${departments.length} 个部门获取用户...`);
          for (let i = 0; i < departments.length; i++) {
            const dept = departments[i];
            try {
              console.log(`[${i + 1}/${departments.length}] 获取部门 ${dept.name || dept.dept_id} (ID: ${dept.dept_id}) 的用户...`);
              
              let cursor: number | undefined = 0;
              let hasMore = true;
              let maxIterations = 20; // 每个部门最多20页
              let deptUserCount = 0;
              
              while (hasMore && cursor !== undefined && maxIterations > 0) {
                try {
                  const result = await this.getUsers(appKey, appSecret, dept.dept_id, cursor);
                  
                  if (result.users && result.users.length > 0) {
                    // 去重（根据 userid）
                    result.users.forEach((user) => {
                      if (!processedUserIds.has(user.userid)) {
                        // 确保用户有部门信息
                        if (!user.dept_id_list) {
                          user.dept_id_list = [dept.dept_id];
                        } else if (!user.dept_id_list.includes(dept.dept_id)) {
                          user.dept_id_list.push(dept.dept_id);
                        }
                        allUsers.push(user);
                        processedUserIds.add(user.userid);
                        deptUserCount++;
                      }
                    });
                  }
                  
                  hasMore = result.hasMore;
                  cursor = result.nextCursor;
                  maxIterations--;
                } catch (error) {
                  // 忽略单个分页的错误，继续处理下一个分页
                  console.warn(`获取部门 ${dept.dept_id} 的用户（分页 ${cursor}）失败:`, error.message);
                  break;
                }
              }
              
              if (deptUserCount > 0) {
                console.log(`  ✅ 部门 ${dept.name || dept.dept_id}: 获取到 ${deptUserCount} 个用户`);
              } else {
                console.log(`  ℹ️  部门 ${dept.name || dept.dept_id}: 没有用户`);
              }
            } catch (error) {
              // 忽略单个部门的错误，继续处理其他部门
              console.warn(`获取部门 ${dept.dept_id} 的用户失败:`, error.message);
            }
          }
          
          console.log(`总共获取到 ${allUsers.length} 个用户`);
        }
      } else {
        // 获取指定部门的用户
        let cursor: number | undefined = 0;
        let hasMore = true;
        let maxIterations = 100; // 防止无限循环
        
        while (hasMore && cursor !== undefined && maxIterations > 0) {
          const result = await this.getUsers(appKey, appSecret, deptId, cursor);
          result.users.forEach((user) => {
            if (!processedUserIds.has(user.userid)) {
              allUsers.push(user);
              processedUserIds.add(user.userid);
            }
          });
          hasMore = result.hasMore;
          cursor = result.nextCursor;
          maxIterations--;
        }
      }
      
      return allUsers;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取所有用户失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 根据用户ID获取用户详情
   */
  async getUserById(
    appKey: string,
    appSecret: string,
    userId: string,
  ): Promise<DingtalkUser | null> {
    try {
      const accessToken = await this.getAccessToken(appKey, appSecret);

      const response = await firstValueFrom(
        this.httpService.post<{ errcode: number; errmsg: string; result?: DingtalkUser }>(
          `${this.baseUrl}/topapi/v2/user/get`,
          {
            userid: userId,
          },
          {
            params: {
              access_token: accessToken,
            },
          },
        ),
      );

      if (response.data.errcode !== 0) {
        throw new HttpException(
          `获取钉钉用户详情失败: ${response.data.errmsg}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      return response.data.result || null;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取钉钉用户详情失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 创建钉钉待办任务（给用户推送“工作台/待办”）。
   *
   * 接口：POST https://oapi.dingtalk.com/topapi/workrecord/add
   * access_token 放在 query 参数里。
   */
  async addToDoTask(options: {
    appKey: string;
    appSecret: string;
    // creator / executor 在 v1.0 todo 创建接口里使用 unionId 语义
    creatorUnionId: string;
    executorUnionIds: string[];
    title: string;
    description?: string;
    dueTime?: number; // Unix秒（如果有）
    sourceIdentifier?: string;
    /**
     * 用于待办详情跳转的 URL（新接口字段名：detailUrl）
     * 旧接口可能使用 source_url/sourceIdentifier 等字段（这里保持兼容）。
     */
    sourceUrl?: string;
  }): Promise<any> {
    const {
      appKey,
      appSecret,
      creatorUnionId,
      executorUnionIds,
      title,
      description,
      dueTime,
      sourceIdentifier,
      sourceUrl,
    } = options;

    const accessToken = await this.getAccessToken(appKey, appSecret);

    /**
     * 新版待办创建（v1.0 todo）
     * 认证：header `x-acs-dingtalk-access-token`
     * 入参：subject / creatorId / executorIds / detailUrl(appUrl/pcUrl)
     *
     * 这里暂时将 creatorId 设置为与 executor 相同的 unionId（即 userid），以满足路径 unionId = creatorId 的要求。
     */
    const body: any = {
      subject: title,
      creatorId: creatorUnionId,
      executorIds: executorUnionIds,
      detailUrl: {
        appUrl: sourceUrl,
        pcUrl: sourceUrl,
      },
    };

    if (description) body.description = description;
    if (dueTime) body.dueTime = dueTime * 1000; // dueTime 需要毫秒
    if (sourceIdentifier) body.sourceId = sourceIdentifier;

    const url = `${this.todoV1BaseUrl}/v1.0/todo/users/${encodeURIComponent(
      creatorUnionId,
    )}/tasks`;
    const response = await firstValueFrom(
      this.httpService.post(url, body, {
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
        },
      }),
    );

    console.log('[DingtalkService] v1.0 todo create response', {
      url,
      errcode: response.data?.errcode,
      errmsg: response.data?.errmsg,
      response: response.data,
    });

    if (response.data?.errcode !== 0 && response.data?.errcode !== undefined) {
      throw new HttpException(
        `创建钉钉待办失败: ${response.data?.errmsg || 'unknown'} (错误码: ${response.data?.errcode})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return response.data;
  }

  /**
   * 更新钉钉待办执行者完成状态（v1.0 todo）。
   *
   * 接口：PUT https://api.dingtalk.com/v1.0/todo/users/{unionId}/tasks/{taskId}/executorStatus
   * - unionId: 资源归属用户 unionId（一般为创建待办时的 creatorUnionId）
   * - executorStatusList[].id: 执行者 unionId
   * - isDone: true 标记完成
   * - operatorId（query，可选）: 操作人 unionId
   */
  async updateTodoExecutorStatus(options: {
    appKey: string;
    appSecret: string;
    unionId: string;
    taskId: string;
    executorUnionIds: string[];
    isDone: boolean;
    operatorUnionId?: string;
  }): Promise<any> {
    const { appKey, appSecret, unionId, taskId, executorUnionIds, isDone, operatorUnionId } =
      options;

    const accessToken = await this.getAccessToken(appKey, appSecret);
    const url = `${this.todoV1BaseUrl}/v1.0/todo/users/${encodeURIComponent(
      unionId,
    )}/tasks/${encodeURIComponent(taskId)}/executorStatus`;

    const body = {
      executorStatusList: executorUnionIds.map((id) => ({ id, isDone })),
    };

    const response = await firstValueFrom(
      this.httpService.put(url, body, {
        params: operatorUnionId ? { operatorId: operatorUnionId } : undefined,
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
        },
      }),
    );

    console.log('[DingtalkService] v1.0 todo update executorStatus response', {
      url,
      response: response.data,
    });

    return response.data;
  }

  /**
   * 获取单个部门详情
   */
  async getDepartment(
    appKey: string,
    appSecret: string,
    deptId: number,
  ): Promise<DingtalkDepartment | null> {
    try {
      const accessToken = await this.getAccessToken(appKey, appSecret);

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/topapi/v2/department/get`,
          { dept_id: deptId },
          {
            params: {
              access_token: accessToken,
            },
          },
        ),
      );

      if (response.data.errcode !== 0) {
        throw new HttpException(
          `获取部门信息失败: ${response.data.errmsg} (错误码: ${response.data.errcode})`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const dept = response.data.result;
      if (!dept) {
        return null;
      }

      return {
        dept_id: dept.dept_id || dept.id,
        id: dept.id || dept.dept_id,
        name: dept.name || `部门_${dept.dept_id || dept.id}`,
        parent_id: dept.parent_id || 0,
        order: dept.order || 0,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取部门信息失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

