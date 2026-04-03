import {
  ForbiddenException,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TenantEntity,
  UserEntity,
  FormDataEntity,
  FormDefinitionEntity,
} from '../../database/entities';

export type TenantLimitsRaw = {
  enabled?: boolean;
  expiresAt?: string;
  maxEnabledUsers?: number;
  maxForms?: number;
  maxRecords?: number;
};

@Injectable()
export class TenantLimitsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(FormDataEntity)
    private readonly formDataRepo: Repository<FormDataEntity>,
    @InjectRepository(FormDefinitionEntity)
    private readonly formDefinitionRepo: Repository<FormDefinitionEntity>,
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

  getLimits(meta: Record<string, unknown>): TenantLimitsRaw {
    const limits = (meta as any)?.limits as TenantLimitsRaw | undefined;
    if (!limits || typeof limits !== 'object') return {};
    return limits;
  }

  async getTenantOrThrow(tenantId: string, tenant?: TenantEntity | null): Promise<TenantEntity> {
    const t =
      tenant ||
      (await this.tenantRepo.findOne({ where: { id: tenantId } }));
    if (!t) {
      throw new ForbiddenException('租户不存在');
    }
    const meta = this.parseMetadata(t.metadata);
    const limits = this.getLimits(meta);

    if (limits.enabled === false) {
      throw new ForbiddenException('租户已停用，请联系管理员');
    }

    if (limits.expiresAt) {
      const exp = new Date(limits.expiresAt);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        throw new ForbiddenException('租户已到期，请联系管理员续期');
      }
    }

    return t;
  }

  /**
   * 新建一条表单数据前检查 maxRecords
   */
  async assertCanCreateRecord(tenantId: string): Promise<void> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const meta = this.parseMetadata(tenant.metadata);
    const maxRecords = this.getLimits(meta).maxRecords;
    if (maxRecords == null || maxRecords <= 0) return;

    const count = await this.formDataRepo.count({ where: { tenantId } });
    if (count >= maxRecords) {
      throw new BadRequestException(
        `已达到数据条数上限（${maxRecords}），无法新建记录`,
      );
    }
  }

  /**
   * 新建一条表单定义前检查 maxForms
   */
  async assertCanCreateForm(tenantId: string): Promise<void> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const meta = this.parseMetadata(tenant.metadata);
    const maxForms = this.getLimits(meta).maxForms;
    if (maxForms == null || maxForms <= 0) return;

    const count = await this.formDefinitionRepo.count({ where: { tenantId } });
    if (count >= maxForms) {
      throw new BadRequestException(`已达到表单数量上限（${maxForms}），无法新建表单`);
    }
  }

  /**
   * 将用户设为启用（status=1）前检查 maxEnabledUsers
   */
  async assertCanEnableUser(tenantId: string, previousStatus: number): Promise<void> {
    if (previousStatus === 1) return;
    const tenant = await this.getTenantOrThrow(tenantId);
    const meta = this.parseMetadata(tenant.metadata);
    const max = this.getLimits(meta).maxEnabledUsers;
    if (max == null || max <= 0) return;

    const enabled = await this.userRepo.count({
      where: { tenantId, status: 1 },
    });
    if (enabled >= max) {
      throw new BadRequestException(
        `已达到启用人员上限（${max}），请先停用其他用户或联系管理员提高配额`,
      );
    }
  }

  async getLimitsSnapshot(tenantId: string): Promise<{
    limits: TenantLimitsRaw;
    formsCount: number;
    recordsCount: number;
    enabledUsersCount: number;
    totalUsersCount: number;
  }> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const meta = this.parseMetadata(tenant.metadata);
    const limits = this.getLimits(meta);
    const [formsCount, recordsCount, enabledUsersCount, totalUsersCount] =
      await Promise.all([
        this.formDefinitionRepo.count({ where: { tenantId } }),
        this.formDataRepo.count({ where: { tenantId } }),
        this.userRepo.count({ where: { tenantId, status: 1 } }),
        this.userRepo.count({ where: { tenantId } }),
      ]);
    return {
      limits,
      formsCount,
      recordsCount,
      enabledUsersCount,
      totalUsersCount,
    };
  }
}
