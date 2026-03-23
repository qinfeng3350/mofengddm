import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessRuleEntity } from '../../database/entities/business-rule.entity';
import { FormDataEntity } from '../../database/entities/form-data.entity';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { BusinessRuleController } from './business-rule.controller';
import { BusinessRuleService } from './business-rule.service';
import { BusinessRuleExecutorService } from './business-rule.executor';
import { FormDataModule } from '../form-data/form-data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessRuleEntity, FormDataEntity, FormDefinitionEntity]),
    forwardRef(() => FormDataModule),
  ],
  controllers: [BusinessRuleController],
  providers: [BusinessRuleService, BusinessRuleExecutorService],
  exports: [BusinessRuleService, BusinessRuleExecutorService],
})
export class BusinessRuleModule {}

