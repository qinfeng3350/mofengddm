import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DingtalkController } from './dingtalk.controller';
import { DingtalkService } from './dingtalk.service';
import { DingtalkSyncService } from './dingtalk-sync.service';
import { UserEntity, DepartmentEntity, TenantEntity } from '../../database/entities';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([UserEntity, DepartmentEntity, TenantEntity]),
  ],
  controllers: [DingtalkController],
  providers: [DingtalkService, DingtalkSyncService],
  exports: [DingtalkService, DingtalkSyncService],
})
export class DingtalkModule {}

