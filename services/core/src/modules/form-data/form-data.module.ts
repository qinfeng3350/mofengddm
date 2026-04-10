import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormDataService } from './form-data.service';
import { FormDataController } from './form-data.controller';
import { FormDataEntity } from '../../database/entities/form-data.entity';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { UserRoleEntity } from '../../database/entities/user-role.entity';
import { RoleEntity } from '../../database/entities/role.entity';
import { WorkflowInstanceEntity } from '../../database/entities/workflow-instance.entity';
import { BusinessRuleModule } from '../business-rule/business-rule.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { TenantMetricsModule } from '../tenant-metrics/tenant-metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormDataEntity,
      FormDefinitionEntity,
      UserRoleEntity,
      RoleEntity,
      WorkflowInstanceEntity,
    ]),
    forwardRef(() => BusinessRuleModule),
    OperationLogModule,
    TenantMetricsModule,
  ],
  controllers: [FormDataController],
  providers: [FormDataService],
  exports: [FormDataService],
})
export class FormDataModule {}
