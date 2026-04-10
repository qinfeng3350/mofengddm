import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { WecomLoginService } from './wecom-login.service';

function getClientIp(req: ExpressRequest): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) {
    return xf.split(',')[0].trim().slice(0, 64);
  }
  const raw = req.socket?.remoteAddress || req.ip || '';
  return String(raw).replace(/^::ffff:/, '').slice(0, 64);
}

@Controller('api/wecom/login')
export class WecomLoginController {
  constructor(private readonly wecomLoginService: WecomLoginService) {}

  @Public()
  @Get('web-url')
  async getWebLoginUrl(
    @Query('redirectUri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
    const url = await this.wecomLoginService.buildWebLoginUrl({
      redirectUri,
      state,
    });
    return { success: true, data: { url } };
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('returnTo') returnTo: string | undefined,
    @Req() req: ExpressRequest,
    @Res() res: Response,
  ) {
    const ua = req.headers['user-agent'];
    const result = await this.wecomLoginService.loginByOAuthCode({
      code,
      ip: getClientIp(req),
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    });

    const redirect = await this.wecomLoginService.buildPortalRedirectUrl({
      token: result.access_token,
      userId: result.user?.id,
      tenantId: result.user?.tenantId,
      state,
      returnTo,
    });

    return res.redirect(redirect);
  }
}

