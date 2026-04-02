import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { TenantLimitsService } from '../../tenant-metrics/tenant-limits.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private readonly tenantLimitsService: TenantLimitsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'your-secret-key',
    });
  }

  async validate(payload: { sub: string; account: string; tenantId: string }) {
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    await this.tenantLimitsService.getTenantOrThrow(user.tenantId);

    return {
      id: user.id,
      userId: user.id,
      account: user.account,
      name: user.name,
      tenantId: user.tenantId,
    };
  }
}

