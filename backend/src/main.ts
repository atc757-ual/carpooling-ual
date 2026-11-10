import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { LogFormat } from './config/configuration';
import { setupApiDocs } from './shared/http/openapi';
import { createRequestLogMiddleware } from './shared/http/request-log.middleware';

async function bootstrap(): Promise<void> {
  // Los mensajes del arranque esperan al logger elegido en la configuración
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = new ConsoleLogger({
    json: configService.getOrThrow<LogFormat>('logFormat') === 'json',
  });
  app.useLogger(logger);
  // Una línea por petición (solo en la aplicación real: en los tests e2e
  // llenaría la salida)
  app.use(createRequestLogMiddleware(logger));
  configureApp(app);

  // Swagger UI en /api/docs (se puede apagar con API_DOCS_ENABLED=false)
  if (configService.getOrThrow<boolean>('apiDocsEnabled')) {
    setupApiDocs(app);
  }
  await app.listen(configService.getOrThrow<number>('port'));
}

void bootstrap();
