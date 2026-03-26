import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowInstanceEntity, FormDefinitionEntity, TenantEntity, UserEntity } from '../../database/entities';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { BusinessRuleModule } from '../business-rule/business-rule.module';
import { DingtalkModule } from '../dingtalk/dingtalk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowInstanceEntity,
      FormDefinitionEntity,
      TenantEntity,
      UserEntity,
    ]),
    forwardRef(() => BusinessRuleModule),
    DingtalkModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
