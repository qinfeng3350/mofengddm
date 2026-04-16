import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OperationLogService } from './operation-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('api/operation-logs')
@UseGuards(JwtAuthGuard)
export class OperationLogController {
  constructor(private readonly operationLogService: OperationLogService) {}

  @Get()
  async getLogs(
    @Request() req: any,
    @Query('formId') formId: string,
    @Query('recordId') recordId?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('无法确定租户，请重新登录');
    }
    
    if (!formId) {
      return [];
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 100;

    if (recordId) {
      return await this.operationLogService.getLogsByRecord(
        tenantId,
        formId,
        recordId,
      );
    }

    return await this.operationLogService.getLogsByForm(
      String(tenantId),
      formId,
      parsedLimit,
    );
  }

  @Get('comments')
  async getComments(
    @Request() req: any,
    @Query('formId') formId: string,
    @Query('recordId') recordId: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('无法确定租户，请重新登录');
    }
    if (!formId || !recordId) {
      throw new BadRequestException('缺少 formId 或 recordId');
    }
    return this.operationLogService.getCommentsByRecord(String(tenantId), formId, recordId);
  }

  @Post('comments')
  async addComment(
    @Request() req: any,
    @Body() body: { formId: string; recordId: string; content: string },
  ) {
    const tenantId = req.user?.tenantId;
    const operatorId = req.user?.id || req.user?.userId;
    const operatorName = req.user?.name;
    if (!tenantId || !operatorId) {
      throw new UnauthorizedException('无法确定用户身份，请重新登录');
    }
    if (!body?.formId || !body?.recordId) {
      throw new BadRequestException('缺少 formId 或 recordId');
    }
    const content = String(body?.content || '').trim();
    if (!content) {
      throw new BadRequestException('评论内容不能为空');
    }
    if (content.length > 2000) {
      throw new BadRequestException('评论内容过长（最多 2000 字）');
    }
    return this.operationLogService.addComment(
      String(tenantId),
      String(body.formId),
      String(body.recordId),
      String(operatorId),
      operatorName ? String(operatorName) : undefined,
      content,
    );
  }

  @Delete('comments/:id')
  async deleteComment(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId;
    const operatorId = req.user?.id || req.user?.userId;
    if (!tenantId || !operatorId) {
      throw new UnauthorizedException('无法确定用户身份，请重新登录');
    }
    const ok = await this.operationLogService.deleteComment(
      String(tenantId),
      String(id),
      String(operatorId),
    );
    if (!ok) {
      throw new ForbiddenException('只能删除自己的评论或评论不存在');
    }
    return { success: true };
  }
}

