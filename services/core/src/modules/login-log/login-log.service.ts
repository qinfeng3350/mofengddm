import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginLogEntity } from '../../database/entities/login-log.entity';

export type LoginLogListQuery = {
  tenantId: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
  userId?: string;
  start?: string;
  end?: string;
};

function inferLocation(ip: string | undefined): string {
  if (!ip) return '未知';
  const n = ip.replace(/^::ffff:/, '').trim();
  if (n === '127.0.0.1' || n === '::1') return '本机';
  return '未知';
}

function inferPlatform(userAgent: string | undefined): string {
  if (!userAgent) return '电脑网页版';
  const l = userAgent.toLowerCase();
  if (l.includes('dingtalk')) return '钉钉手机版';
  if (l.includes('micromessenger')) return '微信内';
  if (
    l.includes('mobile') ||
    l.includes('android') ||
    l.includes('iphone') ||
    l.includes('ipad')
  ) {
    return '手机网页版';
  }
  return '电脑网页版';
}

@Injectable()
export class LoginLogService {
  constructor(
    @InjectRepository(LoginLogEntity)
    private readonly repo: Repository<LoginLogEntity>,
  ) {}

  async record(params: {
    tenantId: string;
    userId: string;
    userName?: string | null;
    ip?: string;
    userAgent?: string | null;
  }): Promise<void> {
    try {
      const ip = (params.ip || '').slice(0, 64);
      const row = this.repo.create({
        tenantId: params.tenantId,
        userId: params.userId,
        userName: params.userName ?? null,
        location: inferLocation(ip),
        platform: inferPlatform(params.userAgent || undefined),
        ip,
        userAgent: params.userAgent ? params.userAgent.slice(0, 2000) : null,
      });
      await this.repo.save(row);
    } catch (e: any) {
      // 兼容：数据库还没执行建表脚本时，不影响登录主流程
      if (e?.code === 'ER_NO_SUCH_TABLE') return;
      throw e;
    }
  }

  async list(q: LoginLogListQuery): Promise<{
    items: Array<{
      id: string;
      userId: string;
      user: string;
      time: string;
      location: string;
      platform: string;
      ip: string;
    }>;
    total: number;
  }> {
    try {
      const page = Math.max(1, q.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 10));
      const qb = this.repo
        .createQueryBuilder('l')
        .where('l.tenantId = :tenantId', { tenantId: q.tenantId });

      if (q.keyword?.trim()) {
        qb.andWhere('l.userName LIKE :kw', {
          kw: `%${q.keyword.trim()}%`,
        });
      }
      if (q.userId?.trim()) {
        qb.andWhere('l.userId = :uid', { uid: q.userId.trim() });
      }
      if (q.start?.trim()) {
        qb.andWhere('l.loginAt >= :start', { start: q.start.trim() });
      }
      if (q.end?.trim()) {
        qb.andWhere('l.loginAt <= :end', { end: q.end.trim() });
      }

      const total = await qb.clone().getCount();
      const rows = await qb
        .orderBy('l.loginAt', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany();

      return {
        total,
        items: rows.map((r) => ({
          id: String(r.id),
          userId: String(r.userId),
          user: r.userName || '',
          time:
            r.loginAt instanceof Date ? r.loginAt.toISOString() : String(r.loginAt),
          location: r.location,
          platform: r.platform,
          ip: r.ip,
        })),
      };
    } catch (e: any) {
      // 兼容：数据库还没执行建表脚本时，前端先显示空列表（避免一直刷 error）
      if (e?.code === 'ER_NO_SUCH_TABLE') {
        return { items: [], total: 0 };
      }
      throw e;
    }
  }

  /** 按日统计「登录过的去重人数」（最近 days 天，含今天） */
  async statsDailyUniqueUsers(
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
        .select('DATE(l.loginAt)', 'day')
        .addSelect('COUNT(DISTINCT l.userId)', 'cnt')
        .where('l.tenantId = :tenantId', { tenantId })
        .andWhere('l.loginAt >= :start', { start })
        .groupBy('DATE(l.loginAt)')
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
