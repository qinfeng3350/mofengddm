import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from '../../database/entities/role.entity';
import { RoleController } from './role.controller';
import { UserRoleEntity } from '../../database/entities/user-role.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { RoleService } from './role.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity, UserRoleEntity, UserEntity])],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}

