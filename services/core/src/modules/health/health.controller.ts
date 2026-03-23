import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async getHealth() {
    const database = await this.healthService.checkDatabase();
    return {
      status: database ? 'ok' : 'degraded',
      database,
    };
  }
}
