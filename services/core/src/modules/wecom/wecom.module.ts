import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TenantEntity, UserEntity } from '../../database/entities';
import { TenantMetricsModule } from '../tenant-metrics/tenant-metrics.module';
import { LoginLogModule } from '../login-log/login-log.module';
import { WecomLoginController } from './wecom-login.controller';
import { WecomLoginService } from './wecom-login.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantEntity, UserEntity]),
    TenantMetricsModule,
    LoginLogModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('jwt.expiresIn') || '7d';
        return {
          secret: configService.get<string>('jwt.secret') || 'your-secret-key',
          signOptions: { expiresIn: expiresIn as any },
        };
      },
    }),
  ],
  controllers: [WecomLoginController],
  providers: [WecomLoginService],
})
export class WecomModule {}

