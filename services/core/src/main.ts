import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

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
    // 开发环境：启用CORS，允许前端访问
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
      credentials: true,
    });
    
    const startupTime = Date.now() - startTime;
    console.log(`🚀 开发模式：后端服务启动成功，端口: ${port}`);
    console.log(`⏱️  启动耗时: ${startupTime}ms`);
  }
  
  try {
    await app.listen(port);
    
    if (!isProduction) {
      const totalTime = Date.now() - startTime;
      console.log(`✅ 服务已就绪，总耗时: ${totalTime}ms`);
      console.log(`📡 API 地址: http://localhost:${port}/api`);
    }
  } catch (error) {
    console.error('❌ 服务启动失败:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ 启动过程中发生错误:', error);
  process.exit(1);
});
