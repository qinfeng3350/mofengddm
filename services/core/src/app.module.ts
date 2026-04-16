import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './modules/health/health.module';
import { ApplicationModule } from './modules/application/application.module';
import { FormDefinitionModule } from './modules/form-definition/form-definition.module';
import { FormDataModule } from './modules/form-data/form-data.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessRuleModule } from './modules/business-rule/business-rule.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { DingtalkModule } from './modules/dingtalk/dingtalk.module';
import { DepartmentModule } from './modules/department/department.module';
import { OperationLogModule } from './modules/operation-log/operation-log.module';
import { TenantMetricsModule } from './modules/tenant-metrics/tenant-metrics.module';
import { UploadModule } from './modules/upload/upload.module';
import { LicensingModule } from './modules/licensing/licensing.module';
import { LoginLogModule } from './modules/login-log/login-log.module';
import { WecomModule } from './modules/wecom/wecom.module';
import { EnterpriseLogModule } from './modules/enterprise-log/enterprise-log.module';
import {
  TenantEntity,
  UserEntity,
  DepartmentEntity,
  RoleEntity,
  UserRoleEntity,
  PermissionEntity,
  RolePermissionEntity,
  ApplicationEntity,
  FormDefinitionEntity,
  FormDataEntity,
  WorkflowDefinitionEntity,
  WorkflowInstanceEntity,
  BusinessRuleEntity,
          BusinessRuleExecutionLogEntity,
  OperationLogEntity,
  LoginLogEntity,
  EnterpriseLogEntity,
  RecordCommentEntity,
} from './database/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env', '../../../.env'],
      expandVariables: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = process.env.NODE_ENV === 'production';
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        return {
          type: 'mysql',
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.user'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.name'),
          // 远程库/网络抖动时，增强自动重连与启动重试
          retryAttempts: 10,
          retryDelay: 3000,
          entities: [
            TenantEntity,
            UserEntity,
            DepartmentEntity,
            RoleEntity,
            UserRoleEntity,
            PermissionEntity,
            RolePermissionEntity,
            ApplicationEntity,
            FormDefinitionEntity,
            FormDataEntity,
            WorkflowDefinitionEntity,
            WorkflowInstanceEntity,
            BusinessRuleEntity,
            OperationLogEntity,
            LoginLogEntity,
            EnterpriseLogEntity,
            RecordCommentEntity,
          ],
          synchronize: false,
          // 优化日志：生产环境关闭，开发环境只记录错误和警告
          logging: isDevelopment ? ['error', 'warn'] : false,
          // 优化连接池配置
          extra: {
            connectionLimit: 10,
            // mysql2 支持：connectTimeout（连接超时）
            // 注意：acquireTimeout/timeout 在 mysql2 里会触发“invalid option”警告，后续版本可能直接报错
            connectTimeout: 20000,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            waitForConnections: true,
            queueLimit: 0,
          },
          // 禁用自动加载实体（提升启动速度）
          autoLoadEntities: false,
        };
      },
    }),
    HealthModule,
    ApplicationModule,
    FormDefinitionModule,
    FormDataModule,
    AuthModule,
    BusinessRuleModule,
    // 新增工作流运行模块
    WorkflowModule,
    UserModule,
    RoleModule,
    DingtalkModule,
    DepartmentModule,
    OperationLogModule,
    TenantMetricsModule,
    UploadModule,
    LicensingModule,
    LoginLogModule,
    WecomModule,
    EnterpriseLogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
