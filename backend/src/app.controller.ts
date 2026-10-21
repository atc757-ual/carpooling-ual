import { Controller, Get } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

@Controller()
export class AppController {
  @Get('health')
  getHealth(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
