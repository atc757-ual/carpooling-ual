import { INestApplication } from '@nestjs/common';
import type { Application } from 'express';
import { requestIdMiddleware } from './shared/http/request-id.middleware';
import { TmfExceptionFilter } from './shared/http/tmf-exception.filter';
import { createValidationPipe } from './shared/http/validation';

export const API_PREFIX = 'api';

// Configuración común a la aplicación real y a los tests e2e
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  // Express anuncia "X-Powered-By: Express" en cada respuesta: se quita para
  // no dar pistas sobre la tecnología del servidor (recomendación de OWASP)
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.disable('x-powered-by');
  // TMF630: X-Request-Id en todas las respuestas y errores con el objeto Error
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new TmfExceptionFilter());
  // Valida los DTO de entrada de todos los controllers
  app.useGlobalPipes(createValidationPipe());
}
