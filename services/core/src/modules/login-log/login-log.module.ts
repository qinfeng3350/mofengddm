import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginLogEntity } from '../../database/entities/login-log.entity';
import { LoginLogService } from './login-log.service';
import { LoginLogController } from './login-log.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LoginLogEntity])],
  controllers: [LoginLogController],
  providers: [LoginLogService],
  exports: [LoginLogService],
})
export class LoginLogModule {}
