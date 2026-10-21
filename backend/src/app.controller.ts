import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Recurso TMF630: lleva @type con el nombre del tipo de recurso
export interface Health {
  '@type': 'Health';
  status: 'ok';
  database: 'up';
  timestamp: string;
}

@Controller()
export class AppController {
  // NestJS inyecta la conexión de TypeORM creada en app.module.ts
  constructor(private readonly dataSource: DataSource) {}

  // GET /api/health: indica si el servidor está vivo y si llega a la base de
  // datos. Si la base de datos no responde, devuelve 503 (Service Unavailable),
  // el código que entienden Docker, Nginx o un balanceador para dejar de
  // enviar tráfico a esta instancia. El filtro TMF630 lo convierte en un
  // Error con el código SERVICE_UNAVAILABLE.
  @Get('health')
  async getHealth(): Promise<Health> {
    if (!(await this.checkDatabase())) {
      throw new ServiceUnavailableException('Database unavailable');
    }
    return {
      '@type': 'Health',
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
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
