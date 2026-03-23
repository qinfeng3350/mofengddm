import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DingtalkService } from './dingtalk.service';
import { DingtalkSyncService } from './dingtalk-sync.service';
import { DingtalkConfigDto } from './dto/dingtalk-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import type { DingtalkDepartment, DingtalkUser } from './types/dingtalk.types';

@Controller('api/dingtalk')
@UseGuards(JwtAuthGuard)
export class DingtalkController {
  constructor(
    private readonly dingtalkService: DingtalkService,
    private readonly dingtalkSyncService: DingtalkSyncService,
  ) {}

  /**
   * 测试连接并获取访问令牌
   */
  @Post('test-connection')
  async testConnection(@Body() config: DingtalkConfigDto) {
    const accessToken = await this.dingtalkService.getAccessToken(
      config.appKey,
      config.appSecret,
    );
    return {
      success: true,
      message: '连接成功',
      accessToken,
    };
  }

  /**
   * 获取部门列表
   */
  @Post('departments')
  async getDepartments(
    @Body() config: DingtalkConfigDto,
    @Query('deptId') deptId?: string,
  ): Promise<{ success: boolean; data: DingtalkDepartment[] }> {
    const departments = await this.dingtalkService.getDepartments(
      config.appKey,
      config.appSecret,
      deptId ? parseInt(deptId, 10) : undefined,
    );
    return {
      success: true,
      data: departments,
    };
  }

  /**
   * 获取所有部门（递归）
   */
  @Post('departments/all')
  async getAllDepartments(
    @Body() config: DingtalkConfigDto,
  ): Promise<{ success: boolean; data: DingtalkDepartment[] }> {
    const departments = await this.dingtalkService.getAllDepartments(
      config.appKey,
      config.appSecret,
    );
    return {
      success: true,
      data: departments,
    };
  }

  /**
   * 获取用户列表
   */
  @Post('users')
  async getUsers(
    @Body() config: DingtalkConfigDto,
    @Query('deptId') deptId?: string,
    @Query('cursor') cursor?: string,
    @Query('size') size?: string,
  ): Promise<{
    success: boolean;
    data: DingtalkUser[];
    hasMore: boolean;
    nextCursor?: number;
  }> {
    const result = await this.dingtalkService.getUsers(
      config.appKey,
      config.appSecret,
      deptId ? parseInt(deptId, 10) : undefined,
      cursor ? parseInt(cursor, 10) : undefined,
      size ? parseInt(size, 10) : 100,
    );
    return {
      success: true,
      data: result.users,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
  }

  /**
   * 获取所有用户
   */
  @Post('users/all')
  async getAllUsers(
    @Body() config: DingtalkConfigDto,
    @Query('deptId') deptId?: string,
  ): Promise<{ success: boolean; data: DingtalkUser[] }> {
    const users = await this.dingtalkService.getAllUsers(
      config.appKey,
      config.appSecret,
      deptId ? parseInt(deptId, 10) : undefined,
    );
    return {
      success: true,
      data: users,
    };
  }

  /**
   * 根据用户ID获取用户详情
   */
  @Post('users/:userId')
  async getUserById(
    @Body() config: DingtalkConfigDto,
    @Param('userId') userId: string,
  ): Promise<{ success: boolean; data: DingtalkUser | null }> {
    const user = await this.dingtalkService.getUserById(
      config.appKey,
      config.appSecret,
      userId,
    );
    return {
      success: true,
      data: user,
    };
  }

  /**
   * 同步钉钉组织架构（部门和用户）
   */
  @Public()
  @Post('sync/organization')
  async syncOrganization(@Body() config: DingtalkConfigDto) {
    const results = await this.dingtalkSyncService.syncOrganization(
      config.appKey,
      config.appSecret,
    );

    const hasPartialSuccess =
      results.departments.created > 0 ||
      results.departments.updated > 0 ||
      results.users.created > 0 ||
      results.users.updated > 0;

    // 如果有数据被处理（即使都是已存在的），也算成功
    const hasDataProcessed =
      results.departments.total > 0 || results.users.total > 0;

    const hasErrors =
      results.departments.errors.length > 0 || results.users.errors.length > 0;

    let message = '';
    if (hasPartialSuccess || hasDataProcessed) {
      message = `同步完成：部门${results.departments.total}个（新增${results.departments.created}，更新${results.departments.updated}），用户${results.users.total}人（新增${results.users.created}，更新${results.users.updated}）`;
      if (hasErrors) {
        message += `。注意：有${results.departments.errors.length}个部门、${results.users.errors.length}个用户同步失败`;
      }
    } else {
      message = '同步失败：未获取到任何数据';
    }

    return {
      success: hasPartialSuccess || (hasDataProcessed && !hasErrors),
      data: results,
      message,
    };
  }
}

