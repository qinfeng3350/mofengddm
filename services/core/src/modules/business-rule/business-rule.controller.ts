import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessRuleService } from './business-rule.service';
import { CreateBusinessRuleDto, UpdateBusinessRuleDto } from './dto/create-business-rule.dto';

@Controller('api/business-rules')
@UseGuards(JwtAuthGuard)
export class BusinessRuleController {
  constructor(private readonly businessRuleService: BusinessRuleService) {}

  @Post()
  async create(@Body() createDto: CreateBusinessRuleDto, @Request() req: any) {
    const tenantId = req.user?.tenantId || '1';
    const userId = req.user?.userId || req.user?.id;
    return await this.businessRuleService.create(createDto, tenantId, userId);
  }

  @Get()
  async findAll(@Query('applicationId') applicationId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '1';
    const rules = await this.businessRuleService.findAll(tenantId, applicationId);
    // 转换为前端需要的格式
    return rules.map((rule) => ({
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      applicationId: rule.applicationId,
      trigger: rule.trigger,
      actions: rule.actions,
      metadata: rule.metadata,
    }));
  }

  @Get(':ruleId')
  async findOne(@Param('ruleId') ruleId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '1';
    const rule = await this.businessRuleService.findOne(ruleId, tenantId);
    return {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      applicationId: rule.applicationId,
      trigger: rule.trigger,
      actions: rule.actions,
      metadata: rule.metadata,
    };
  }

  @Put(':ruleId')
  async update(
    @Param('ruleId') ruleId: string,
    @Body() updateDto: UpdateBusinessRuleDto,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId || '1';
    const userId = req.user?.userId || req.user?.id;
    const rule = await this.businessRuleService.update(ruleId, updateDto, tenantId, userId);
    return {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      applicationId: rule.applicationId,
      trigger: rule.trigger,
      actions: rule.actions,
      metadata: rule.metadata,
    };
  }

  @Delete(':ruleId')
  async remove(@Param('ruleId') ruleId: string, @Request() req: any) {
    const tenantId = req.user?.tenantId || '1';
    await this.businessRuleService.remove(ruleId, tenantId);
    return { success: true };
  }

  @Patch(':ruleId/enabled')
  async toggleEnabled(
    @Param('ruleId') ruleId: string,
    @Body() body: { enabled: boolean },
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId || '1';
    const rule = await this.businessRuleService.toggleEnabled(ruleId, body.enabled, tenantId);
    return {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      description: rule.description,
      enabled: rule.enabled,
      priority: rule.priority,
      applicationId: rule.applicationId,
      trigger: rule.trigger,
      actions: rule.actions,
      metadata: rule.metadata,
    };
  }
}

