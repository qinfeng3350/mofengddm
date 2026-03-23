import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormDataService } from './form-data.service';
import { FormDataController } from './form-data.controller';
import { FormDataEntity } from '../../database/entities/form-data.entity';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { BusinessRuleModule } from '../business-rule/business-rule.module';
import { OperationLogModule } from '../operation-log/operation-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormDataEntity, FormDefinitionEntity]),
    forwardRef(() => BusinessRuleModule),
    OperationLogModule,
  ],
  controllers: [FormDataController],
  providers: [FormDataService],
  exports: [FormDataService],
})
export class FormDataModule {}
