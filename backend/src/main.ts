import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupApiDocs } from './shared/http/openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const configService = app.get(ConfigService);
  // Swagger UI en /api/docs (se puede apagar con API_DOCS_ENABLED=false)
  if (configService.getOrThrow<boolean>('apiDocsEnabled')) {
    setupApiDocs(app);
  }
  await app.listen(configService.getOrThrow<number>('port'));
}

void bootstrap();
