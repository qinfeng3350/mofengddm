import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationService } from './application.service';
import { ApplicationController } from './application.controller';
import { ApplicationFormsController } from './application-forms.controller';
import { ApplicationEntity } from '../../database/entities/application.entity';
import { TenantEntity } from '../../database/entities/tenant.entity';
import { FormDefinitionModule } from '../form-definition/form-definition.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationEntity, TenantEntity]),
    FormDefinitionModule,
  ],
  controllers: [ApplicationController, ApplicationFormsController],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}

