import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { buildOpenApiDocument } from './shared/http/openapi';

// npm run openapi: escribe docs/api/openapi.json a partir del código, para
// consultar la API sin arrancar el servidor. El CI comprueba que está al día.
// preview: true monta los módulos sin crear sus servicios, así que no se
// conecta a la base de datos
const OUTPUT_FILE = join(__dirname, '..', '..', 'docs', 'api', 'openapi.json');

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  configureApp(app);

  const document = buildOpenApiDocument(app);
  writeFileSync(OUTPUT_FILE, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void generateOpenApi();
