import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { TenantEntity, UserEntity } from '../../database/entities';
import { DingtalkService } from './dingtalk.service';

type DingConfig = {
  appKey: string;
  appSecret: string;
};

@Injectable()
export class DingtalkLoginService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly dingtalkService: DingtalkService,
  ) {}

  private parseMetadata(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
  }

  private async resolveTenant(options: {
    tenantId?: string;
    tenantCode?: string;
  }): Promise<TenantEntity> {
    const { tenantId, tenantCode } = options;
    if (!tenantId && !tenantCode) {
      // 前端不传租户时，自动从已配置 dingtalk 的租户中选一个
      const tenants = await this.tenantRepository.find({
        where: { status: 1 },
        select: ['id', 'code', 'name', 'status', 'metadata', 'updatedAt'],
        order: { updatedAt: 'DESC' },
        take: 50,
      });
      const candidates = tenants.filter((t) => {
        const meta = this.parseMetadata(t.metadata);
        const ding = (meta as any)?.dingtalk;
        return !!ding?.appKey && !!ding?.appSecret;
      });

      if (candidates.length === 0) {
        throw new BadRequestException(
          '未找到可用的钉钉租户配置，请先在 tenants.metadata.dingtalk 配置 appKey/appSecret',
        );
      }
      // 如果配置了多个租户，为了“登录不需要额外填写”，默认选择最近更新的那一个
      // 仍允许通过 tenantId/tenantCode 显式指定租户以避免登录到错误租户
      return candidates[0];
    }
    const tenant = await this.tenantRepository.findOne({
      where: tenantId ? { id: tenantId } : { code: tenantCode! },
    });
    if (!tenant) {
      throw new BadRequestException('租户不存在');
    }
    return tenant;
  }

  private resolveDingConfig(tenant: TenantEntity): DingConfig {
    const meta = this.parseMetadata(tenant.metadata);
    const ding = (meta as any)?.dingtalk || {};
    const appKey = ding?.appKey ? String(ding.appKey) : '';
    const appSecret = ding?.appSecret ? String(ding.appSecret) : '';
    if (!appKey || !appSecret) {
      throw new BadRequestException(
        '当前租户未配置钉钉 appKey/appSecret（请保存到 tenants.metadata.dingtalk）',
      );
    }
    return { appKey, appSecret };
  }

  async buildWebLoginUrl(options: {
    tenantId?: string;
    tenantCode?: string;
    redirectUri?: string;
    state?: string;
  }): Promise<string> {
    const tenant = await this.resolveTenant(options);
    const { appKey } = this.resolveDingConfig(tenant);

    const baseRedirect =
      options.redirectUri ||
      (this.configService.get<string>('PORTAL_BASE_URL')
        ? `${this.configService.get<string>('PORTAL_BASE_URL')}/api/dingtalk/login/callback`
        : undefined);

    if (!baseRedirect) {
      throw new BadRequestException(
        '缺少 redirectUri，且未配置 PORTAL_BASE_URL（用于生成默认回调地址）',
      );
    }

    // 统一把 tenantId/tenantCode 带回 callback，便于后端识别租户
    const callbackUrl = new URL(baseRedirect);
    if (options.tenantId) callbackUrl.searchParams.set('tenantId', options.tenantId);
    if (options.tenantCode) callbackUrl.searchParams.set('tenantCode', options.tenantCode);
    if (options.state) callbackUrl.searchParams.set('state', options.state);

    // DingTalk OAuth2 授权地址（通用方式，code 换取 userAccessToken）
    const authUrl = new URL('https://login.dingtalk.com/oauth2/auth');
    authUrl.searchParams.set('client_id', appKey);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
    if (options.state) authUrl.searchParams.set('state', options.state);

    return authUrl.toString();
  }

  async loginByOAuthCode(options: {
    tenantId?: string;
    tenantCode?: string;
    code?: string;
  }): Promise<{ access_token: string; user: any }> {
    if (!options.code) {
      throw new BadRequestException('缺少 code/authCode');
    }
    const tenant = await this.resolveTenant(options);
    const { appKey, appSecret } = this.resolveDingConfig(tenant);

    const tokenResp = await this.dingtalkService.exchangeOAuthUserAccessToken({
      clientId: appKey,
      clientSecret: appSecret,
      code: options.code,
    });

    const me = await this.dingtalkService.getOAuthUserInfo({
      userAccessToken: tokenResp.accessToken,
    });

    const unionId = me.unionId ? String(me.unionId) : '';
    if (!unionId) {
      throw new BadRequestException('钉钉返回的用户 unionId 为空，无法登录');
    }

    const found = await this.userRepository
      .createQueryBuilder('u')
      .where('u.tenant_id = :tenantId', { tenantId: tenant.id })
      .andWhere("JSON_EXTRACT(u.metadata, '$.dingtalkUnionId') = :unionId", { unionId })
      .getOne();

    const user =
      found ||
      (await this.createUserIfNotExists({
        tenantId: tenant.id,
        unionId,
        name: me.nick || `钉钉用户_${unionId.slice(0, 6)}`,
        avatar: me.avatarUrl || null,
      }));

    const payload = {
      sub: user.id,
      account: user.account,
      tenantId: user.tenantId,
    };

    return {
      access_token: this.jwtService.sign(payload),
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

  private async createUserIfNotExists(options: {
    tenantId: string;
    unionId: string;
    name: string;
    avatar: string | null;
  }): Promise<UserEntity> {
    const account = `dingtalk_union_${options.unionId}`;
    const exists = await this.userRepository.findOne({ where: { account } });
    if (exists) return exists;

    const passwordHash = await bcrypt.hash(`dt_${Date.now()}_${Math.random()}`, 10);
    const user = this.userRepository.create({
      account,
      name: options.name,
      email: `${options.unionId}@dingtalk.local`,
      phone: null as any,
      passwordHash,
      tenantId: options.tenantId,
      status: 1,
      avatar: options.avatar || undefined,
      metadata: {
        dingtalkUnionId: options.unionId,
        createdBy: 'dingtalk-login',
        createdAt: new Date().toISOString(),
      },
    } as Partial<UserEntity>);

    return this.userRepository.save(user);
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
      // 兜底：不重定向，直接返回 token（callback 场景一般要求重定向；这里给出可诊断信息）
      throw new BadRequestException('未配置 PORTAL_BASE_URL，无法构造回跳地址');
    }

    // 默认回到 portal 的 /login，并带上 token
    const url = new URL(options.returnTo || `${base}/login`);
    url.searchParams.set('token', options.token);
    if (options.state) url.searchParams.set('state', options.state);
    if (options.userId) url.searchParams.set('userId', options.userId);
    if (options.tenantId) url.searchParams.set('tenantId', options.tenantId);
    return url.toString();
  }
}

