import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { ApplicationEntity, TenantEntity, UserEntity } from '../../database/entities';
import {
  getExpiresAtByDuration,
  signLicensePayload,
  verifyAndDecodeLicenseKey,
  type LicenseDuration,
  type LicenseLimits,
} from './license-codec';

type GenerateLicenseInput = {
  duration: LicenseDuration;
  enabled?: boolean;
  tenantName?: string;
  maxEnabledUsers?: number;
  maxForms?: number;
  maxRecords?: number;
};

type ProvisionInput = {
  licenseKey: string;
  adminAccount: string;
  adminName: string;
  adminPassword: string;
};

@Injectable()
export class LicensingService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applicationRepository: Repository<ApplicationEntity>,
    private readonly jwtService: JwtService,
  ) {}

  generateLicenseKey(input: GenerateLicenseInput): {
    licenseKey: string;
    licenseId: string;
    issuedAt: number;
    expiresAt: number;
  } {
    const secret = process.env.LICENSE_SIGN_SECRET;
    if (!secret) {
      throw new Error('未配置 LICENSE_SIGN_SECRET');
    }

    const issuedAt = Date.now();
    const expiresAt = getExpiresAtByDuration(input.duration, issuedAt);
    const licenseId = crypto.randomUUID();

    const limits: LicenseLimits = {
      enabled: input.enabled ?? true,
      maxEnabledUsers: input.maxEnabledUsers,
      maxForms: input.maxForms,
      maxRecords: input.maxRecords,
    };

    const payload = {
      v: 1 as const,
      licenseId,
      tenantName: input.tenantName,
      issuedAt,
      expiresAt,
      limits,
    };

    const licenseKey = signLicensePayload(payload, secret);
    return { licenseKey, licenseId, issuedAt, expiresAt };
  }

  async provisionFromLicenseKey(input: ProvisionInput): Promise<{
    access_token: string;
    user: { id: string; account: string; name: string; tenantId: string };
    tenant: { id: string; code: string; name: string };
  }> {
    const secret = process.env.LICENSE_SIGN_SECRET;
    if (!secret) {
      throw new Error('未配置 LICENSE_SIGN_SECRET');
    }

    let payload;
    try {
      payload = verifyAndDecodeLicenseKey(input.licenseKey, secret);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'licenseKey 无效');
    }

    if (payload.expiresAt < Date.now()) {
      throw new BadRequestException('licenseKey 已到期');
    }

    // 若启用配额但 maxEnabledUsers<=0，则无法至少创建管理员用户
    if (payload.limits.enabled && payload.limits.maxEnabledUsers != null && payload.limits.maxEnabledUsers <= 0) {
      throw new BadRequestException('maxEnabledUsers <= 0：无法创建管理员以完成安装');
    }

    // 当前代码体系大量“默认租户”依赖 code='default'，安装时固定写入该租户
    let tenant = await this.tenantRepository.findOne({ where: { code: 'default' } });
    if (!tenant) {
      tenant = this.tenantRepository.create({
        code: 'default',
        name: payload.tenantName || '默认租户',
        status: 1,
        metadata: {},
      });
    } else if (payload.tenantName) {
      tenant.name = payload.tenantName;
    }

    tenant.status = payload.limits.enabled ? 1 : 0;
    tenant.metadata = {
      limits: {
        enabled: payload.limits.enabled,
        expiresAt: new Date(payload.expiresAt).toISOString(),
        maxEnabledUsers: payload.limits.maxEnabledUsers,
        maxForms: payload.limits.maxForms,
        maxRecords: payload.limits.maxRecords,
      },
    };
    const savedTenant = await this.tenantRepository.save(tenant);

    // 创建/更新安装管理员
    let user = await this.userRepository.findOne({ where: { account: input.adminAccount } });
    const passwordHash = await bcrypt.hash(input.adminPassword, 10);

    if (!user) {
      user = this.userRepository.create({
        account: input.adminAccount,
        name: input.adminName,
        tenantId: savedTenant.id,
        status: payload.limits.enabled ? 1 : 0,
        passwordHash,
      });
    } else {
      // account 唯一：安装场景下直接覆盖租户归属
      user.tenantId = savedTenant.id;
      user.name = input.adminName;
      user.passwordHash = passwordHash;
      user.status = payload.limits.enabled ? 1 : user.status;
    }

    const savedUser = await this.userRepository.save(user);

    // 创建默认应用（让表单创建可用）
    const defaultAppCode = `default-app-${savedTenant.id}`;
    const existingApp = await this.applicationRepository.findOne({
      where: { tenantId: savedTenant.id, code: defaultAppCode },
    });

    if (!existingApp) {
      await this.applicationRepository.save(
        this.applicationRepository.create({
          tenantId: savedTenant.id,
          name: '默认应用',
          code: defaultAppCode,
          status: 'draft',
          metadata: JSON.stringify({}),
        }),
      );
    }

    const tokenPayload = {
      sub: savedUser.id,
      account: savedUser.account,
      tenantId: savedUser.tenantId,
    };
    const access_token = this.jwtService.sign(tokenPayload);

    return {
      access_token,
      user: { id: savedUser.id, account: savedUser.account, name: savedUser.name, tenantId: savedUser.tenantId },
      tenant: { id: String(savedTenant.id), code: savedTenant.code, name: savedTenant.name },
    };
  }

  private parseMetadata(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
  }

  async adminListTenants(): Promise<
    Array<{
      id: string;
      code: string;
      name: string;
      status: number;
      limits: LicenseLimits & { expiresAt?: string };
    }>
  > {
    const tenants = await this.tenantRepository.find();
    return tenants.map((t) => {
      const meta = this.parseMetadata(t.metadata);
      const limits = (meta?.limits || {}) as any;
      return {
        id: String(t.id),
        code: t.code,
        name: t.name,
        status: t.status,
        limits: {
          enabled: Boolean(limits.enabled ?? true),
          expiresAt: limits.expiresAt ? String(limits.expiresAt) : undefined,
          maxEnabledUsers: limits.maxEnabledUsers,
          maxForms: limits.maxForms,
          maxRecords: limits.maxRecords,
        },
      };
    });
  }

  async adminUpdateTenantLimits(
    tenantId: string,
    input: {
      enabled?: boolean;
      expiresAt?: string | null;
      maxEnabledUsers?: number | null;
      maxForms?: number | null;
      maxRecords?: number | null;
    },
  ): Promise<{
    tenant: { id: string; code: string; name: string; status: number };
    limits: LicenseLimits & { expiresAt?: string };
  }> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new BadRequestException('租户不存在');
    }

    const meta = this.parseMetadata(tenant.metadata);
    const prevLimits = (meta?.limits || {}) as any;

    const enabled = input.enabled ?? prevLimits.enabled ?? true;
    const expiresAt =
      input.expiresAt === undefined ? prevLimits.expiresAt : input.expiresAt === null ? undefined : input.expiresAt;

    const nextLimits: LicenseLimits & { expiresAt?: string } = {
      enabled: Boolean(enabled),
      expiresAt: expiresAt ? String(expiresAt) : undefined,
      maxEnabledUsers: input.maxEnabledUsers === undefined ? prevLimits.maxEnabledUsers : input.maxEnabledUsers ?? undefined,
      maxForms: input.maxForms === undefined ? prevLimits.maxForms : input.maxForms ?? undefined,
      maxRecords: input.maxRecords === undefined ? prevLimits.maxRecords : input.maxRecords ?? undefined,
    };

    tenant.status = nextLimits.enabled ? 1 : 0;
    tenant.metadata = {
      ...meta,
      limits: {
        enabled: nextLimits.enabled,
        expiresAt: nextLimits.expiresAt,
        maxEnabledUsers: nextLimits.maxEnabledUsers,
        maxForms: nextLimits.maxForms,
        maxRecords: nextLimits.maxRecords,
      },
    };

    await this.tenantRepository.save(tenant);
    return {
      tenant: { id: String(tenant.id), code: tenant.code, name: tenant.name, status: tenant.status },
      limits: nextLimits,
    };
  }
}

