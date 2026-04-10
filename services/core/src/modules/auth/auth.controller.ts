import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Req,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { TenantEntity } from '../../database/entities/tenant.entity';

function getClientIp(req: ExpressRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim().slice(0, 64);
  }
  const raw = req.socket?.remoteAddress || req.ip || '';
  return String(raw).replace(/^::ffff:/, '').slice(0, 64);
}

@UseGuards(JwtAuthGuard)
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
  ) {}

  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() req: ExpressRequest) {
    const ua = req.headers['user-agent'];
    return this.authService.login(loginDto, {
      ip: getClientIp(req),
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    });
  }

  @Get('profile')
  async getProfile(@Request() req) {
    // 获取完整的用户信息（包括头像和租户信息）
    const fullUser = await this.authService.validateUser(req.user.id || req.user.userId);
    
    if (!fullUser) {
      throw new Error('用户不存在');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: fullUser.tenantId },
      select: ['id', 'code', 'name'],
    });

    return {
      id: fullUser.id,
      account: fullUser.account,
      name: fullUser.name,
      email: fullUser.email,
      phone: fullUser.phone,
      avatar: fullUser.avatar || null,
      tenantId: fullUser.tenantId,
      tenant: tenant ? {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
      } : null,
    };
  }

  @Get('me')
  async getMe(@Request() req) {
    // 获取完整的用户信息（包括头像和租户信息）
    const fullUser = await this.authService.validateUser(req.user.id || req.user.userId);
    
    if (!fullUser) {
      throw new Error('用户不存在');
    }

    const tenant = await this.tenantRepository.findOne({
      where: { id: fullUser.tenantId },
      select: ['id', 'code', 'name'],
    });

    return {
      id: fullUser.id,
      account: fullUser.account,
      name: fullUser.name,
      email: fullUser.email,
      phone: fullUser.phone,
      avatar: fullUser.avatar || null,
      tenantId: fullUser.tenantId,
      tenant: tenant ? {
        id: tenant.id,
        code: tenant.code,
        name: tenant.name,
      } : null,
    };
  }

  /**
   * 修改密码
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Request() req,
    @Body()
    body: {
      oldPassword?: string;
      newPassword: string;
    },
  ) {
    if (!body.newPassword || body.newPassword.length < 6) {
      throw new Error('新密码长度不能小于 6 位');
    }

    const userId = req.user.id || req.user.userId;
    await this.authService.changePassword(
      userId,
      body.oldPassword,
      body.newPassword,
    );

    return { success: true };
  }

  /**
   * 获取当前账号可切换的租户列表
   */
  @Get('tenants')
  async getTenants(@Request() req: any) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('无法确定当前用户');
    }
    return this.authService.getTenantsByUserId(String(userId));
  }

  /**
   * 切换租户：生成新的 JWT（sub=userId，tenantId=user.tenantId）
   */
  @Post('switch-tenant')
  async switchTenant(
    @Request() req: any,
    @Body() body: { tenantId: string },
    @Req() ereq: ExpressRequest,
  ) {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      throw new Error('无法确定当前用户');
    }
    const ua = ereq.headers['user-agent'];
    return this.authService.switchTenantByUserId(String(userId), body.tenantId, {
      ip: getClientIp(ereq),
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    });
  }
}

