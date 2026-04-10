import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  WorkflowInstanceEntity,
  FormDefinitionEntity,
  FormDataEntity,
  TenantEntity,
  UserEntity,
} from '../../database/entities';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { BusinessRuleModule } from '../business-rule/business-rule.module';
import { DingtalkModule } from '../dingtalk/dingtalk.module';
import { EnterpriseLogModule } from '../enterprise-log/enterprise-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowInstanceEntity,
      FormDefinitionEntity,
      FormDataEntity,
      TenantEntity,
      UserEntity,
    ]),
    forwardRef(() => BusinessRuleModule),
    DingtalkModule,
    EnterpriseLogModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
