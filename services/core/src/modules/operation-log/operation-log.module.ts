import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogEntity } from '../../database/entities/operation-log.entity';
import { OperationLogService } from './operation-log.service';
import { OperationLogController } from './operation-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OperationLogEntity])],
  providers: [OperationLogService],
  controllers: [OperationLogController],
  exports: [OperationLogService],
})
export class OperationLogModule {}

