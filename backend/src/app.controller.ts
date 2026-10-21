import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthStatus {
  status: 'ok' | 'error';
  database: 'up' | 'down';
  timestamp: string;
}

@Controller()
export class AppController {
  // NestJS inyecta la conexión de TypeORM creada en app.module.ts
  constructor(private readonly dataSource: DataSource) {}

  // GET /api/health: indica si el servidor está vivo y si llega a la base de
  // datos. Si la base de datos no responde, devuelve 503 (Service Unavailable),
  // el código que entienden Docker, Nginx o un balanceador para dejar de
  // enviar tráfico a esta instancia.
  @Get('health')
  async getHealth(): Promise<HealthStatus> {
    const isDatabaseUp = await this.checkDatabase();
    const health: HealthStatus = {
      status: isDatabaseUp ? 'ok' : 'error',
      database: isDatabaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };

    if (!isDatabaseUp) {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }

  // SELECT 1 es la consulta más barata posible: solo comprueba que la base de
  // datos contesta, sin leer ninguna tabla
  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
