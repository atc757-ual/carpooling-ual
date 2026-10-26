import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { setupApiDocs } from '../src/shared/http/openapi';

const COMMITTED_OPENAPI = join(
  __dirname,
  '..',
  '..',
  'docs',
  'api',
  'openapi.json',
);

// Documentación OpenAPI: Swagger UI se sirve y el fichero del repositorio
// (docs/api/openapi.json) coincide con el código
describe('API docs (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    setupApiDocs(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger UI at /api/docs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);

    expect(response.text).toContain('swagger-ui');
  });

  it('documents every endpoint in the OpenAPI document', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs/openapi.json')
      .expect(200);

    const { paths } = response.body as { paths: Record<string, object> };
    expect(Object.keys(paths).sort()).toEqual([
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me',
      '/api/auth/password-reset',
      '/api/auth/password-reset/confirm',
      '/api/auth/password-reset/verify',
      '/api/auth/refresh',
      '/api/auth/register',
      '/api/auth/verify-email',
      '/api/auth/verify-email/resend',
      '/api/health',
      '/api/incidents',
      '/api/incidents/{id}',
      '/api/incidents/{id}/review',
      '/api/notifications/{id}/read',
      '/api/requests/{id}',
      '/api/requests/{id}/accept',
      '/api/requests/{id}/cancel',
      '/api/requests/{id}/reject',
      '/api/trips',
      '/api/trips/{id}',
      '/api/trips/{id}/cancel',
      '/api/trips/{id}/finish',
      '/api/trips/{id}/route',
      '/api/trips/{id}/start',
      '/api/trips/{tripId}/incidents',
      '/api/trips/{tripId}/position',
      '/api/trips/{tripId}/positions',
      '/api/trips/{tripId}/requests',
      '/api/users',
      '/api/users/me/driver-declaration',
      '/api/users/me/driver-status',
      '/api/users/me/incidents',
      '/api/users/me/notifications',
      '/api/users/me/notifications/read',
      '/api/users/me/profiles/{profile}',
      '/api/users/me/requests',
      '/api/users/me/trips',
      '/api/users/{id}',
      '/api/users/{id}/profiles/{profile}',
      '/api/vehicles',
      '/api/vehicles/{id}',
    ]);
  });

  it('docs/api/openapi.json is up to date (if not: npm run openapi)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs/openapi.json')
      .expect(200);

    const committed: unknown = JSON.parse(
      readFileSync(COMMITTED_OPENAPI, 'utf8'),
    );
    expect(response.body).toEqual(committed);
  });
});
