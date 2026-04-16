import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessRuleEntity } from '../../database/entities/business-rule.entity';
import { BusinessRuleExecutionLogEntity } from '../../database/entities/business-rule-execution-log.entity';
import { FormDataEntity } from '../../database/entities/form-data.entity';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { BusinessRuleController } from './business-rule.controller';
import { BusinessRuleService } from './business-rule.service';
import { BusinessRuleExecutorService } from './business-rule.executor';
import { FormDataModule } from '../form-data/form-data.module';
import { OperationLogModule } from '../operation-log/operation-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessRuleEntity, BusinessRuleExecutionLogEntity, FormDataEntity, FormDefinitionEntity]),
    forwardRef(() => FormDataModule),
    OperationLogModule,
  ],
  controllers: [BusinessRuleController],
  providers: [BusinessRuleService, BusinessRuleExecutorService],
  exports: [BusinessRuleService, BusinessRuleExecutorService],
})
export class BusinessRuleModule {}

