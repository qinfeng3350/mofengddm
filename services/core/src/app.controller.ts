import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('api')
  getApiInfo() {
    return {
      name: '墨枫低代码平台 API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        auth: '/api/auth',
        applications: '/api/applications',
        forms: '/api/form-definitions',
        data: '/api/form-data',
        users: '/api/users',
        workflows: '/api/workflows',
        businessRules: '/api/business-rules',
      },
    };
  }
}
