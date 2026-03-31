import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DingtalkController } from './dingtalk.controller';
import { DingtalkService } from './dingtalk.service';
import { DingtalkSyncService } from './dingtalk-sync.service';
import { DingtalkStreamService } from './dingtalk-stream.service';
import { UserEntity, DepartmentEntity, TenantEntity } from '../../database/entities';
import { DingtalkLoginController } from './dingtalk-login.controller';
import { DingtalkLoginService } from './dingtalk-login.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([UserEntity, DepartmentEntity, TenantEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('jwt.expiresIn') || '7d';
        return {
          secret: configService.get<string>('jwt.secret') || 'your-secret-key',
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
    }),
  ],
  controllers: [DingtalkController, DingtalkLoginController],
  providers: [
    DingtalkService,
    DingtalkSyncService,
    DingtalkStreamService,
    DingtalkLoginService,
  ],
  exports: [
    DingtalkService,
    DingtalkSyncService,
    DingtalkStreamService,
    DingtalkLoginService,
  ],
})
export class DingtalkModule {}

