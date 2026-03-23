import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormDefinitionService } from './form-definition.service';
import { FormDefinitionController } from './form-definition.controller';
import { FormDefinitionEntity } from '../../database/entities/form-definition.entity';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { ApplicationEntity } from '../../database/entities/application.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FormDefinitionEntity, TenantEntity, ApplicationEntity])],
  controllers: [FormDefinitionController],
  providers: [FormDefinitionService],
  exports: [FormDefinitionService],
})
export class FormDefinitionModule {}
