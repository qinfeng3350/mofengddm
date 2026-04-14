import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller(['api/workflows', 'workflows'])
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Post('start')
  async start(@Body() body: any, @Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || '1';
    const userId = req.user?.id || req.user?.userId || body?.userId;
    const userName = req.user?.name || req.user?.username || body?.userName;
    return this.service.start({
      tenantId: String(tenantId),
      formId: body.formId,
      recordId: body.recordId,
      workflow: body.workflow,
      userId: userId ? String(userId) : undefined,
      userName,
    });
  }

  @Post('preview-assignees')
  async previewAssignees(@Body() body: any, @Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || '1';
    const userId = req.user?.id || req.user?.userId || body?.initiatorUserId;
    return this.service.previewAssignees({
      tenantId: String(tenantId),
      workflow: body?.workflow || {},
      data: body?.data || {},
      initiatorUserId: userId ? String(userId) : undefined,
      initiatorDeptId: body?.initiatorDeptId ? String(body.initiatorDeptId) : undefined,
    });
  }

  @Get('instances/:instanceId')
  async get(@Param('instanceId') instanceId: string, @Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || '1';
    return this.service.getInstance(instanceId, String(tenantId));
  }

  @Get('instances/by-record/:recordId')
  async getByRecord(@Param('recordId') recordId: string, @Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || '1';
    return this.service.getInstanceByRecord(recordId, String(tenantId));
  }

  @Get('tasks')
  async tasks(@Query('status') status: string, @Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || '1';
    const userId = req.user?.id || req.user?.userId;
    // 默认返回“我的待办”：按当前登录用户过滤
    return this.service.listTasks(String(tenantId), {
      status: status as any,
      userId: userId ? String(userId) : undefined,
    });
  }

  @Post('instances/:instanceId/action')
  async action(@Param('instanceId') instanceId: string, @Body() body: any, @Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || '1';
    const userId = req.user?.id || req.user?.userId;
    const userName = req.user?.name || req.user?.username;
    return this.service.action(instanceId, String(tenantId), { nodeId: body.nodeId, action: body.action, comment: body.comment, userId, userName });
  }
}
