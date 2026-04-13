import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import * as https from 'https';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { LoginLogService } from '../login-log/login-log.service';
import { TenantLimitsService } from '../tenant-metrics/tenant-limits.service';
import { TenantEntity, UserEntity } from '../../database/entities';

type WecomConfig = {
  corpId: string;
  agentId: string;
  corpSecret: string;
};

function mustEnv(v: string | undefined, name: string) {
  if (!v) throw new BadRequestException(`未配置 ${name}`);
  return v;
}

@Injectable()
export class WecomLoginService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly tenantLimitsService: TenantLimitsService,
    private readonly loginLogService: LoginLogService,
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private readonly http = axios.create({
    timeout: 15000,
    httpsAgent: new https.Agent({ keepAlive: true }),
  });

  private async getWithRetry(url: string, tries: number = 3) {
    let lastErr: any;
    for (let i = 0; i < tries; i++) {
      try {
        return await this.http.get(url);
      } catch (err: any) {
        lastErr = err;
        const code = err?.code;
        // 典型网络抖动/重置：重试
        if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
          await new Promise((r) => setTimeout(r, 300 * (i + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  private getWecomConfig(): WecomConfig {
    // 企业微信登录先走环境变量（单独、与钉钉完全分开）
    const corpId = mustEnv(this.configService.get<string>('WECOM_CORP_ID'), 'WECOM_CORP_ID');
    const agentId = mustEnv(this.configService.get<string>('WECOM_AGENT_ID'), 'WECOM_AGENT_ID');
    const corpSecret = mustEnv(
      this.configService.get<string>('WECOM_CORP_SECRET'),
      'WECOM_CORP_SECRET',
    );
    return { corpId, agentId, corpSecret };
  }

  async buildWebLoginUrl(options: { redirectUri?: string; state?: string }): Promise<string> {
    const { corpId, agentId } = this.getWecomConfig();

    const baseRedirect =
      options.redirectUri ||
      (this.configService.get<string>('PORTAL_BASE_URL')
        ? `${this.configService.get<string>('PORTAL_BASE_URL')}/api/wecom/login/callback`
        : undefined);

    if (!baseRedirect) {
      throw new BadRequestException(
        '缺少 redirectUri，且未配置 PORTAL_BASE_URL（用于生成默认回调地址）',
      );
    }

    const callbackUrl = new URL(baseRedirect);
    if (options.state) callbackUrl.searchParams.set('state', options.state);

    const authUrl = new URL('https://login.work.weixin.qq.com/wwlogin/sso/login');
    authUrl.searchParams.set('login_type', 'CorpApp');
    authUrl.searchParams.set('appid', corpId);
    authUrl.searchParams.set('agentid', agentId);
    authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
    if (options.state) authUrl.searchParams.set('state', options.state);

    return authUrl.toString();
  }

  private async getAccessToken(): Promise<string> {
    const { corpId, corpSecret } = this.getWecomConfig();
    const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/gettoken');
    url.searchParams.set('corpid', corpId);
    url.searchParams.set('corpsecret', corpSecret);
    const res = await this.getWithRetry(url.toString());
    const data = res.data || {};
    if (data.errcode !== 0 || !data.access_token) {
      throw new BadRequestException(`企业微信 gettoken 失败：${data.errmsg || data.errcode}`);
    }
    return data.access_token as string;
  }

  private async getUserIdByCode(accessToken: string, code: string): Promise<string> {
    const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('code', code);
    const res = await this.getWithRetry(url.toString());
    const data = res.data || {};
    if (data.errcode !== 0) {
      throw new BadRequestException(
        `企业微信 getuserinfo 失败：${data.errmsg || data.errcode}`,
      );
    }
    if (!data.userid) {
      throw new BadRequestException('企业微信返回 userid 为空，无法登录');
    }
    return String(data.userid);
  }

  private async getUserDetail(accessToken: string, userId: string): Promise<any> {
    const url = new URL('https://qyapi.weixin.qq.com/cgi-bin/user/get');
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('userid', userId);
    const res = await this.getWithRetry(url.toString());
    const data = res.data || {};
    if (data.errcode !== 0) {
      throw new BadRequestException(`企业微信 user/get 失败：${data.errmsg || data.errcode}`);
    }
    return data;
  }

  private async ensureTenantForWecom(): Promise<TenantEntity> {
    const { corpId } = this.getWecomConfig();
    const code = `wecom_${corpId}`;
    const exists = await this.tenantRepo.findOne({ where: { code } });
    if (exists) return exists;

    const tenant = this.tenantRepo.create({
      code,
      name: `企业微信-${corpId}`,
      status: 1,
      metadata: {
        createdBy: 'wecom-login',
        wecom: { corpId },
      },
    } as Partial<TenantEntity>);
    return this.tenantRepo.save(tenant);
  }

  private async ensureUser(
    tenantId: string,
    wecomUserId: string,
    detail: any,
  ): Promise<UserEntity> {
    const account = `wecom_${wecomUserId}`;
    const exists = await this.userRepo.findOne({ where: { tenantId, account } });
    if (exists) return exists;

    const passwordHash = await bcrypt.hash(`wecom_${Date.now()}_${Math.random()}`, 10);
    const u = this.userRepo.create({
      tenantId,
      account,
      name: detail?.name || wecomUserId,
      email: detail?.email || `${wecomUserId}@wecom.local`,
      phone: detail?.mobile || null,
      avatar: detail?.avatar || null,
      passwordHash,
      status: 1,
      metadata: {
        wecomUserId,
        createdBy: 'wecom-login',
        createdAt: new Date().toISOString(),
      },
    } as Partial<UserEntity>) as UserEntity;
    return this.userRepo.save(u);
  }

  async loginByOAuthCode(options: {
    code?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<{ access_token: string; user: any }> {
    if (!options.code) throw new BadRequestException('缺少 code');

    const tenant = await this.ensureTenantForWecom();
    await this.tenantLimitsService.getTenantOrThrow(String(tenant.id), tenant as any);

    const accessToken = await this.getAccessToken();
    const wecomUserId = await this.getUserIdByCode(accessToken, options.code);
    const detail = await this.getUserDetail(accessToken, wecomUserId);
    const user = await this.ensureUser(String(tenant.id), wecomUserId, detail);

    const payload = { sub: user.id, account: user.account, tenantId: user.tenantId };
    const token = this.jwtService.sign(payload);

    try {
      await this.loginLogService.record({
        tenantId: String(user.tenantId),
        userId: String(user.id),
        userName: user.name,
        ip: options.ip,
        userAgent: options.userAgent,
      });
    } catch {
      // ignore
    }

    return {
      access_token: token,
      user: {
        id: user.id,
        account: user.account,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar || null,
        tenantId: user.tenantId,
      },
    };
  }

  async buildPortalRedirectUrl(options: {
    token: string;
    userId?: string;
    tenantId?: string;
    state?: string;
    returnTo?: string;
  }): Promise<string> {
    const base = this.configService.get<string>('PORTAL_BASE_URL');
    if (!base) {
      throw new BadRequestException('未配置 PORTAL_BASE_URL，无法构造回跳地址');
    }
    const url = new URL(options.returnTo || `${base}/login`);
    url.searchParams.set('token', options.token);
    if (options.state) url.searchParams.set('state', options.state);
    if (options.userId) url.searchParams.set('userId', options.userId);
    if (options.tenantId) url.searchParams.set('tenantId', options.tenantId);
    return url.toString();
  }
}

