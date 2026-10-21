import { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api';

// Configuración común a la aplicación real y a los tests e2e
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}
