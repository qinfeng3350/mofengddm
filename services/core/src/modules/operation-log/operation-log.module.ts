import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLogEntity } from '../../database/entities/operation-log.entity';
import { RecordCommentEntity } from '../../database/entities/record-comment.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { OperationLogService } from './operation-log.service';
import { OperationLogController } from './operation-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OperationLogEntity, RecordCommentEntity, UserEntity])],
  providers: [OperationLogService],
  controllers: [OperationLogController],
  exports: [OperationLogService],
})
export class OperationLogModule {}

