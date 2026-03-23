import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowInstanceEntity, FormDefinitionEntity, TenantEntity } from '../../database/entities';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { BusinessRuleModule } from '../business-rule/business-rule.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkflowInstanceEntity, FormDefinitionEntity, TenantEntity]),
    forwardRef(() => BusinessRuleModule),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
