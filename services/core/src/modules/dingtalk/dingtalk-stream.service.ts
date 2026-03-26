import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { TenantEntity } from '../../database/entities';

/**
 * 钉钉 Stream 模式连接（事件订阅/机器人/回调通道）。
 *
 * 说明：
 * - 该连接用于“Stream 推送方式”的通道验证与事件接收
 * - 与 workrecord/add（待办推送）是两条不同的能力链路
 */
@Injectable()
export class DingtalkStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DingtalkStreamService.name);
  // 注意：这里不能使用 dingtalk-stream 的静态类型导入，否则在依赖未安装时会导致 TS2307 编译失败
  private client: any | null = null;
  private lastError: string | null = null;
  private hasCredentials = false;
  private enabled = false;

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
  ) {}

  onModuleInit() {
    const envClientId =
      process.env.DINGTALK_STREAM_CLIENT_ID || process.env.DINGTALK_APP_KEY;
    const envClientSecret =
      process.env.DINGTALK_STREAM_CLIENT_SECRET || process.env.DINGTALK_APP_SECRET;

    const parseTenantMetadata = (value: unknown): Record<string, unknown> => {
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
    };

    // onModuleInit 不能写 async，所以用 IIFE
    void (async () => {
      // 1) 优先环境变量；2) 兜底从 tenants.metadata.dingtalk 读取
      let clientId = envClientId;
      let clientSecret = envClientSecret;

      if (!clientId || !clientSecret) {
        const tenants = await this.tenantRepository.find({
          select: ['id', 'metadata'],
          take: 50,
        });

        for (const t of tenants) {
          const meta = parseTenantMetadata((t as any).metadata);
          const ding = (meta as any)?.dingtalk;
          if (ding?.appKey && ding?.appSecret) {
            clientId = String(ding.appKey);
            clientSecret = String(ding.appSecret);
            break;
          }
        }
      }

      if (!clientId || !clientSecret) {
        this.enabled = false;
        this.hasCredentials = false;
        this.logger.log(
          'Stream 未启用：缺少 DINGTALK_STREAM_CLIENT_ID/DINGTALK_STREAM_CLIENT_SECRET（或 DINGTALK_APP_KEY/DINGTALK_APP_SECRET），且 tenants.metadata.dingtalk 未找到 appKey/appSecret',
        );
        return;
      }

      this.enabled = true;
      this.hasCredentials = true;
      this.lastError = null;

      this.logger.log('正在启动钉钉 Stream 连接...');

      let streamPkg: any;
      try {
        // 延迟加载：避免依赖未安装时在“编译期”直接报 TS2307
        streamPkg = require('dingtalk-stream');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.enabled = false;
        this.hasCredentials = false;
        this.lastError = msg;
        this.logger.error('Stream 依赖 dingtalk-stream 未安装或加载失败', msg);
        return;
      }

      const DWClient = streamPkg?.DWClient;
      const EventAck = streamPkg?.EventAck;

      if (!DWClient || !EventAck) {
        this.enabled = false;
        this.hasCredentials = false;
        this.lastError = 'dingtalk-stream 包结构异常：缺少 DWClient/EventAck';
        this.logger.error(this.lastError);
        return;
      }

      const client = new DWClient({ clientId, clientSecret });

      // 注册一个通用 listener，保证通道可验证；事件类型由钉钉后台勾选决定
      client.registerAllEventListener((event: any) => {
        try {
          this.logger.debug(
            `收到 Stream 事件: eventType=${event.headers?.eventType} eventId=${event.headers?.eventId}`,
          );
        } catch {
          // ignore
        }
        const successStatus = EventAck.SUCCESS ?? 'SUCCESS';
        return { status: successStatus, message: 'OK' };
      });

      // 连接（SDK 内部会建立 websocket；connect() resolve 通常意味着 socket open）
      void client
        .connect()
        .then(() => {
          this.logger.log(
            `Stream 连接已建立：connected=${client.connected} registered=${client.registered}`,
          );
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.lastError = msg;
          this.logger.error('Stream 连接失败', msg);
        });

      this.client = client;
      this.logger.log('钉钉 Stream 已发起连接（请在钉钉后台点击“验证连接通道”）。');
    })();
  }

  getStatus(): {
    enabled: boolean;
    hasCredentials: boolean;
    connected: boolean;
    registered: boolean;
    lastError: string | null;
  } {
    return {
      enabled: this.enabled,
      hasCredentials: this.hasCredentials,
      connected: !!this.client?.connected,
      registered: !!this.client?.registered,
      lastError: this.lastError,
    };
  }

  onModuleDestroy() {
    // SDK 暂未暴露统一 close 方法；尽量释放引用即可
    this.client = null;
  }
}

