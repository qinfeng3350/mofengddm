import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserEntity } from '../../database/entities/user.entity';
import { UserRoleEntity } from '../../database/entities/user-role.entity';
import { RoleEntity } from '../../database/entities/role.entity';
import { TenantMetricsModule } from '../tenant-metrics/tenant-metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleEntity, RoleEntity]),
    TenantMetricsModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

