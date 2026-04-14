import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function bootstrap() {
  const startTime = Date.now();
  
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // 禁用启动时的详细日志（提升启动速度）
    logger: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['log', 'error', 'warn'],
  });
  
  const configService = app.get(ConfigService);
  const isProduction = process.env.NODE_ENV === 'production';
  const port = configService.get<number>('port') ?? 4000;

  // 全局输入校验：白名单 + 禁止多余字段 + 自动类型转换
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 基础安全响应头（避免依赖安装失败时无法启用 helmet）
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // 对 SPA/静态资源友好：不强制过严 CSP，后续可按域名与资源策略再收紧
    if (isProduction) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    }
    next();
  });

  // 轻量限流（内存版）：严格模式下至少防止登录爆破/接口刷爆
  // 如需分布式限流，建议后续接入 Redis + 专用中间件或网关/WAF。
  const rateStore = new Map<string, { n: number; resetAt: number }>();
  const nowMs = () => Date.now();
  const getIp = (req: any) => {
    const xf = String(req.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim();
    return xf || req.ip || req.socket?.remoteAddress || 'unknown';
  };
  const hit = (key: string, limit: number, windowMs: number) => {
    const now = nowMs();
    const cur = rateStore.get(key);
    if (!cur || cur.resetAt <= now) {
      rateStore.set(key, { n: 1, resetAt: now + windowMs });
      return { ok: true, left: limit - 1, resetAt: now + windowMs };
    }
    cur.n += 1;
    rateStore.set(key, cur);
    return { ok: cur.n <= limit, left: Math.max(0, limit - cur.n), resetAt: cur.resetAt };
  };
  // 简单清理，避免无限增长
  setInterval(() => {
    const now = nowMs();
    for (const [k, v] of rateStore) {
      if (v.resetAt <= now) rateStore.delete(k);
    }
  }, 30_000).unref?.();

  app.use((req, res, next) => {
    const path = String(req.path || '');
    if (!path.startsWith('/api')) return next();
    const ip = getIp(req);

    const isLoginLike =
      path === '/api/auth/login' ||
      path.startsWith('/api/dingtalk/login') ||
      path.startsWith('/api/wecom/login');

    // 登录类：更严格
    if (isLoginLike) {
      const r = hit(`login:${ip}:${path}`, 10, 60_000);
      res.setHeader('X-RateLimit-Limit', '10');
      res.setHeader('X-RateLimit-Remaining', String(r.left));
      if (!r.ok) return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
      return next();
    }

    // 其他 API：宽松一些（避免误伤正常操作）
    const r = hit(`api:${ip}`, 600, 60_000);
    res.setHeader('X-RateLimit-Limit', '600');
    res.setHeader('X-RateLimit-Remaining', String(r.left));
    if (!r.ok) return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
    return next();
  });
  
  // CORS：生产按白名单，开发保留现有白名单
  const corsOriginsRaw =
    configService.get<string>('CORS_ORIGINS') ||
    configService.get<string>('cors.origins') ||
    '';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const corsCredentials =
    String(configService.get<string>('CORS_CREDENTIALS') || '').trim() === '1';

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: corsCredentials,
    });
  }

  // 生产环境：服务前端静态文件
  if (isProduction) {
    // 静态文件路径：从 dist/main.js 到 apps/portal/dist
    const frontendDistPath = join(__dirname, '../../../../apps/portal/dist');
    
    // 设置静态文件目录（不设置 prefix，直接服务根路径）
    app.useStaticAssets(frontendDistPath, {
      index: false,
    });
    
    // 所有非 API 请求都返回 index.html（支持前端路由）
    app.use((req, res, next) => {
      // API 请求直接通过
      if (req.path.startsWith('/api')) {
        return next();
      }
      // 静态资源请求直接通过
      if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/)) {
        return next();
      }
      // 其他请求返回前端 index.html（支持前端路由）
      res.sendFile(join(frontendDistPath, 'index.html'), (err) => {
        if (err) {
          console.error('发送 index.html 失败:', err);
          res.status(404).send('页面未找到');
        }
      });
    });
    
    console.log(`🚀 生产模式：后端服务 + 前端静态文件`);
    console.log(`   前端路径: ${frontendDistPath}`);
    console.log(`   端口: ${port}`);
    console.log(`   访问地址: http://localhost:${port}`);
  } else {
    // 开发环境：若未配置 CORS_ORIGINS，保留默认白名单
    if (corsOrigins.length === 0) {
      app.enableCors({
        origin: [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:5180',
          'http://70a2818b.r16.cpolar.top',
          'https://70a2818b.r16.cpolar.top',
          'http://936a8de.r16.cpolar.top',
          'https://936a8de.r16.cpolar.top',
        ],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        // 默认使用 bearer token，不需要 credentials；如确需 cookie 再用 CORS_CREDENTIALS=1
        credentials: false,
      });
    }
    
    const startupTime = Date.now() - startTime;
    console.log(`🚀 开发模式：后端服务启动成功，端口: ${port}`);
    console.log(`⏱️  启动耗时: ${startupTime}ms`);
  }
  
  // watch 模式下进程热重启时，旧实例可能会短暂占用端口，做短重试避免误报 EADDRINUSE。
  const maxListenRetries = isProduction ? 1 : 8;
  let listenAttempt = 0;
  while (listenAttempt < maxListenRetries) {
    try {
      await app.listen(port);
      if (!isProduction) {
        const totalTime = Date.now() - startTime;
        console.log(`✅ 服务已就绪，总耗时: ${totalTime}ms`);
        console.log(`📡 API 地址: http://localhost:${port}/api`);
      }
      break;
    } catch (error: any) {
      const isAddrInUse = error?.code === 'EADDRINUSE';
      listenAttempt += 1;
      if (!isAddrInUse || listenAttempt >= maxListenRetries) {
        console.error('❌ 服务启动失败:', error);
        process.exit(1);
      }
      const waitMs = 400 * listenAttempt;
      console.warn(
        `⚠️ 端口 ${port} 仍被占用（第 ${listenAttempt}/${maxListenRetries} 次重试），${waitMs}ms 后重试...`,
      );
      await sleep(waitMs);
    }
  }
}

bootstrap().catch((error) => {
  console.error('❌ 启动过程中发生错误:', error);
  process.exit(1);
});
