import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnterpriseLogEntity } from '../../database/entities/enterprise-log.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { ApplicationEntity } from '../../database/entities/application.entity';

export type EnterpriseLogCategory = 'platform' | 'app' | 'message';

@Injectable()
export class EnterpriseLogService {
  constructor(
    @InjectRepository(EnterpriseLogEntity)
    private readonly repo: Repository<EnterpriseLogEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ApplicationEntity)
    private readonly applicationRepo: Repository<ApplicationEntity>,
  ) {}

  private static isLikelyAppId(relatedApp: string): boolean {
    return /^\d+$/.test(relatedApp.trim());
  }

  /** 应用日志里曾只存 applicationId；展示与落库时解析为应用名称 */
  private async resolveRelatedAppLabel(
    tenantId: string,
    category: EnterpriseLogCategory,
    relatedApp?: string | null,
  ): Promise<string | null> {
    const raw = relatedApp?.trim();
    if (!raw) return null;
    if (category !== 'app' || !EnterpriseLogService.isLikelyAppId(raw)) {
      return raw;
    }
    try {
      const app = await this.applicationRepo.findOne({
        where: { id: raw, tenantId },
        select: ['name', 'code'],
      });
      if (!app) return raw;
      const label = app.name?.trim() || app.code?.trim() || raw;
      return label.length > 128 ? label.slice(0, 128) : label;
    } catch {
      return raw;
    }
  }

  /** 列表：历史行 related_app 存的是 ID 时补成名称（不写回库） */
  private async hydrateRelatedAppLabels(
    tenantId: string,
    items: EnterpriseLogEntity[],
  ): Promise<void> {
    const need = items.filter(
      (i) =>
        i.category === 'app' &&
        i.relatedApp?.trim() &&
        EnterpriseLogService.isLikelyAppId(i.relatedApp),
    );
    if (!need.length) return;
    const ids = [...new Set(need.map((i) => String(i.relatedApp).trim()))];
    const apps = await this.applicationRepo.find({
      where: { tenantId, id: In(ids) },
      select: ['id', 'name', 'code'],
    });
    const map = new Map<string, string>();
    for (const a of apps) {
      let label = a.name?.trim() || a.code?.trim();
      if (label) {
        if (label.length > 128) label = label.slice(0, 128);
        map.set(String(a.id), label);
      }
    }
    for (const row of items) {
      if (
        row.category === 'app' &&
        row.relatedApp?.trim() &&
        EnterpriseLogService.isLikelyAppId(row.relatedApp)
      ) {
        const label = map.get(String(row.relatedApp).trim());
        if (label) row.relatedApp = label;
      }
    }
  }

  /** 有 operatorId 但未传姓名时，从 users 表补全，供列表「操作人」展示 */
  private async resolveOperatorName(
    operatorId?: string,
    operatorName?: string,
  ): Promise<string | null> {
    const trimmed = operatorName?.trim();
    if (trimmed) return trimmed;
    const id = operatorId?.trim();
    if (!id) return null;
    try {
      const u = await this.userRepo.findOne({
        where: { id },
        select: ['name', 'account'],
      });
      if (!u) return null;
      const name = u.name?.trim();
      return name || u.account?.trim() || null;
    } catch {
      return null;
    }
  }

  /** 列表展示：历史行可能只有 operatorId，按需补姓名（不写回库） */
  private async hydrateOperatorNames(items: EnterpriseLogEntity[]): Promise<void> {
    const need = items.filter((i) => !i.operatorName?.trim() && i.operatorId?.trim());
    if (!need.length) return;
    const ids = [...new Set(need.map((i) => String(i.operatorId)))].filter(Boolean);
    if (!ids.length) return;
    const users = await this.userRepo.find({
      where: { id: In(ids) },
      select: ['id', 'name', 'account'],
    });
    const map = new Map<string, string>();
    for (const u of users) {
      const label = u.name?.trim() || u.account?.trim();
      if (label) map.set(String(u.id), label);
    }
    for (const row of items) {
      if (!row.operatorName?.trim() && row.operatorId) {
        const label = map.get(String(row.operatorId));
        if (label) row.operatorName = label;
      }
    }
  }

  async log(params: {
    tenantId: string;
    category: EnterpriseLogCategory;
    subtype?: string;
    operatorId?: string;
    operatorName?: string;
    receiver?: string;
    operationType?: string;
    triggerType?: string;
    errorType?: string;
    relatedApp?: string;
    relatedObject?: string;
    content?: string;
    detail?: string;
    ip?: string;
  }): Promise<void> {
    try {
      const operatorName = await this.resolveOperatorName(
        params.operatorId,
        params.operatorName,
      );
      const relatedApp = await this.resolveRelatedAppLabel(
        params.tenantId,
        params.category,
        params.relatedApp,
      );
      const row = this.repo.create({
        tenantId: params.tenantId,
        category: params.category,
        subtype: params.subtype || null,
        operatorId: params.operatorId || null,
        operatorName,
        receiver: params.receiver || null,
        operationType: params.operationType || null,
        triggerType: params.triggerType || null,
        errorType: params.errorType || null,
        relatedApp,
        relatedObject: params.relatedObject || null,
        content: params.content || null,
        detail: params.detail || null,
        ip: (params.ip || '').slice(0, 64),
      });
      await this.repo.save(row);
    } catch (e: any) {
      // 表未迁移时不中断主流程
      if (e?.code === 'ER_NO_SUCH_TABLE') return;
      throw e;
    }
  }

  async list(params: {
    tenantId: string;
    category: EnterpriseLogCategory;
    subtype?: string;
    keyword?: string;
    operationType?: string;
    triggerType?: string;
    start?: string;
    end?: string;
    page?: number;
    pageSize?: number;
  }) {
    try {
      const page = Math.max(1, params.page || 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
      const qb = this.repo
        .createQueryBuilder('l')
        .where('l.tenantId = :tenantId', { tenantId: params.tenantId })
        .andWhere('l.category = :category', { category: params.category });

      if (params.subtype && params.subtype !== 'all') {
        qb.andWhere('l.subtype = :subtype', { subtype: params.subtype });
      }
      if (params.keyword?.trim()) {
        const kw = `%${params.keyword.trim()}%`;
        qb.andWhere(
          '(l.operatorName LIKE :kw OR l.detail LIKE :kw OR l.relatedObject LIKE :kw OR l.relatedApp LIKE :kw)',
          { kw },
        );
      }
      if (params.operationType && params.operationType !== 'all') {
        qb.andWhere('l.operationType = :operationType', {
          operationType: params.operationType,
        });
      }
      if (params.triggerType && params.triggerType !== 'all') {
        qb.andWhere('l.triggerType = :triggerType', {
          triggerType: params.triggerType,
        });
      }
      if (params.start?.trim()) qb.andWhere('l.createdAt >= :start', { start: params.start });
      if (params.end?.trim()) qb.andWhere('l.createdAt <= :end', { end: params.end });

      const total = await qb.clone().getCount();
      const items = await qb
        .orderBy('l.createdAt', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany();
      await this.hydrateOperatorNames(items);
      await this.hydrateRelatedAppLabels(params.tenantId, items);
      return { items, total };
    } catch (e: any) {
      if (e?.code === 'ER_NO_SUCH_TABLE') return { items: [], total: 0 };
      throw e;
    }
  }

  /** 按日统计企业日志条数（全部分类，最近 days 天） */
  async statsDailyOperations(
    tenantId: string,
    days = 30,
  ): Promise<{ date: string; count: number }[]> {
    const safeDays = Math.min(90, Math.max(1, Number(days) || 30));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (safeDays - 1));
    const map = new Map<string, number>();
    try {
      const rows = await this.repo
        .createQueryBuilder('l')
        .select('DATE(l.createdAt)', 'day')
        .addSelect('COUNT(*)', 'cnt')
        .where('l.tenantId = :tenantId', { tenantId })
        .andWhere('l.createdAt >= :start', { start })
        .groupBy('DATE(l.createdAt)')
        .orderBy('day', 'ASC')
        .getRawMany();
      for (const r of rows) {
        const key = this.normalizeDayKey(r.day);
        map.set(key, Number(r.cnt) || 0);
      }
    } catch (e: any) {
      if (e?.code === 'ER_NO_SUCH_TABLE') {
        return this.fillDailySeries(start, safeDays, map);
      }
      throw e;
    }
    return this.fillDailySeries(start, safeDays, map);
  }

  private normalizeDayKey(day: unknown): string {
    if (day == null) return '';
    if (typeof day === 'string') return day.slice(0, 10);
    if (day instanceof Date) return day.toISOString().slice(0, 10);
    return String(day).slice(0, 10);
  }

  private fillDailySeries(
    start: Date,
    dayCount: number,
    map: Map<string, number>,
  ): { date: string; count: number }[] {
    const out: { date: string; count: number }[] = [];
    const cur = new Date(start);
    for (let i = 0; i < dayCount; i++) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      out.push({ date: key, count: map.get(key) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }
}

