import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnterpriseLogEntity } from '../../database/entities/enterprise-log.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ApplicationEntity } from '../../database/entities/application.entity';
import { EnterpriseLogService } from './enterprise-log.service';
import { EnterpriseLogController } from './enterprise-log.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EnterpriseLogEntity, UserEntity, ApplicationEntity]),
  ],
  controllers: [EnterpriseLogController],
  providers: [EnterpriseLogService],
  exports: [EnterpriseLogService],
})
export class EnterpriseLogModule {}

