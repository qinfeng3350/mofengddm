import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationService } from './application.service';
import { ApplicationController } from './application.controller';
import { ApplicationFormsController } from './application-forms.controller';
import { ApplicationEntity } from '../../database/entities/application.entity';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { FormDefinitionModule } from '../form-definition/form-definition.module';
import { EnterpriseLogModule } from '../enterprise-log/enterprise-log.module';
import { RoleModule } from '../role/role.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationEntity, TenantEntity]),
    FormDefinitionModule,
    EnterpriseLogModule,
    RoleModule,
  ],
  controllers: [ApplicationController, ApplicationFormsController],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}

