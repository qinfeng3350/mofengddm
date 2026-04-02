import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  FormDataEntity,
  FormDefinitionEntity,
  TenantEntity,
  UserEntity,
} from '../../database/entities';
import { TenantMetricsController } from './tenant-metrics.controller';
import { TenantLimitsService } from './tenant-limits.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormDefinitionEntity,
      FormDataEntity,
      UserEntity,
      TenantEntity,
    ]),
  ],
  controllers: [TenantMetricsController],
  providers: [TenantLimitsService],
  exports: [TenantLimitsService],
})
export class TenantMetricsModule {}
