import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LicensingController } from './licensing.controller';
import { LicensingService } from './licensing.service';
import { ApplicationEntity, TenantEntity, UserEntity } from '../../database/entities';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TenantEntity, UserEntity, ApplicationEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get<string>('jwt.secret') || 'your-secret-key',
        };
      },
    }),
  ],
  controllers: [LicensingController],
  providers: [LicensingService],
})
export class LicensingModule {}

