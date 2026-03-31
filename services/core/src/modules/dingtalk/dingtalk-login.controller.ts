import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { DingtalkLoginService } from './dingtalk-login.service';

@Controller('api/dingtalk/login')
export class DingtalkLoginController {
  constructor(private readonly dingtalkLoginService: DingtalkLoginService) {}

  /**
   * 网页扫码登录（第三方站点）：
   * 前端只需要传 tenantId/tenantCode（不落地 appKey/appSecret 到文件），后端从 tenants.metadata.dingtalk 读取 appKey/appSecret 生成授权 URL。
   */
  @Public()
  @Get('web-url')
  async getWebLoginUrl(
    @Query('tenantId') tenantId?: string,
    @Query('tenantCode') tenantCode?: string,
    @Query('redirectUri') redirectUri?: string,
    @Query('state') state?: string,
  ) {
    const url = await this.dingtalkLoginService.buildWebLoginUrl({
      tenantId,
      tenantCode,
      redirectUri,
      state,
    });
    return { success: true, data: { url } };
  }

  /**
   * 网页扫码回调：钉钉带 code/authCode 回来
   * 这里直接签发我们系统 JWT，并重定向回 portal（token 放在 query）。
   */
  @Public()
  @Get('callback')
  async webCallback(
    @Query('tenantId') tenantId: string | undefined,
    @Query('tenantCode') tenantCode: string | undefined,
    @Query('code') code: string | undefined,
    @Query('authCode') authCode: string | undefined,
    @Query('state') state: string | undefined,
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ) {
    const finalCode = code || authCode;
    const result = await this.dingtalkLoginService.loginByOAuthCode({
      tenantId,
      tenantCode,
      code: finalCode,
    });

    const redirect = await this.dingtalkLoginService.buildPortalRedirectUrl({
      token: result.access_token,
      userId: result.user?.id,
      tenantId: result.user?.tenantId,
      state,
      returnTo,
    });

    return res.redirect(redirect);
  }

  /**
   * H5 免登：前端在钉钉容器内拿到 code（JSAPI authCode），POST 给后端换取用户信息并签发 JWT。
   */
  @Public()
  @Post('h5')
  async h5Login(
    @Body()
    body: {
      tenantId?: string;
      tenantCode?: string;
      code: string;
    },
  ) {
    const result = await this.dingtalkLoginService.loginByOAuthCode({
      tenantId: body.tenantId,
      tenantCode: body.tenantCode,
      code: body.code,
    });
    return { success: true, data: result };
  }
}

