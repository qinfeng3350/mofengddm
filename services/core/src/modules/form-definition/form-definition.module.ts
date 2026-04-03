import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormDefinitionService } from './form-definition.service';
import { FormDefinitionController } from './form-definition.controller';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { ApplicationEntity } from '../../database/entities/application.entity';
import { TenantMetricsModule } from '../tenant-metrics/tenant-metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FormDefinitionEntity, TenantEntity, ApplicationEntity]),
    TenantMetricsModule,
  ],
  controllers: [FormDefinitionController],
  providers: [FormDefinitionService],
  exports: [FormDefinitionService],
})
export class FormDefinitionModule {}
