import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserEntity, TenantEntity } from '../../database/entities';
import { TenantMetricsModule } from '../tenant-metrics/tenant-metrics.module';
import { LoginLogModule } from '../login-log/login-log.module';
import { EnterpriseLogModule } from '../enterprise-log/enterprise-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, TenantEntity]),
    LoginLogModule,
    EnterpriseLogModule,
    TenantMetricsModule,
    PassportModule,
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}

