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
      '/api/admin/catalogs/avatars',
      '/api/admin/catalogs/avatars/{key}',
      '/api/admin/catalogs/avatars/{key}/move',
      '/api/admin/catalogs/campus-parkings',
      '/api/admin/catalogs/campus-parkings/{id}',
      '/api/admin/catalogs/campus-parkings/{id}/move',
      '/api/admin/catalogs/travel-preferences',
      '/api/admin/catalogs/travel-preferences/{key}',
      '/api/admin/catalogs/travel-preferences/{key}/move',
      '/api/admin/catalogs/vehicle-brands',
      '/api/admin/catalogs/vehicle-brands/{key}',
      '/api/admin/catalogs/vehicle-brands/{key}/move',
      '/api/admin/catalogs/vehicle-colors',
      '/api/admin/catalogs/vehicle-colors/{key}',
      '/api/admin/catalogs/vehicle-colors/{key}/move',
      '/api/admin/events',
      '/api/admin/events/{id}',
      '/api/admin/legal-documents',
      '/api/admin/legal-documents/{type}/draft',
      '/api/admin/legal-documents/{type}/draft/publish',
      '/api/admin/overview',
      '/api/admin/simulations',
      '/api/admin/simulations/scenarios',
      '/api/admin/simulations/{id}',
      '/api/admin/simulations/{id}/cancel',
      '/api/admin/simulations/{id}/results',
      '/api/admin/simulations/{id}/results.csv',
      '/api/admin/trips',
      '/api/admin/trips/{id}',
      '/api/admin/users',
      '/api/admin/users/{id}',
      '/api/admin/users/{id}/suspensions/{role}/lift',
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
      '/api/avatars',
      '/api/avatars/{id}',
      '/api/avatars/{id}/image',
      '/api/campus-parkings',
      '/api/campus-parkings/{id}',
      '/api/catalogs/travel-preferences',
      '/api/catalogs/vehicle-brands',
      '/api/catalogs/vehicle-colors',
      '/api/health',
      '/api/incidents',
      '/api/incidents/{id}',
      '/api/incidents/{id}/review',
      '/api/legal-documents/{type}',
      '/api/notifications/{id}/read',
      '/api/places',
      '/api/places/reverse',
      '/api/places/{id}',
      '/api/requests/{id}',
      '/api/requests/{id}/accept',
      '/api/requests/{id}/board',
      '/api/requests/{id}/cancel',
      '/api/requests/{id}/no-show',
      '/api/requests/{id}/reject',
      '/api/support/messages',
      '/api/trips',
      '/api/trips/search',
      '/api/trips/{id}',
      '/api/trips/{id}/cancel',
      '/api/trips/{id}/finish',
      '/api/trips/{id}/messages',
      '/api/trips/{id}/messages/read',
      '/api/trips/{id}/messages/{messageId}/report',
      '/api/trips/{id}/route',
      '/api/trips/{id}/start',
      '/api/trips/{tripId}/incidents',
      '/api/trips/{tripId}/position',
      '/api/trips/{tripId}/positions',
      '/api/trips/{tripId}/requests',
      '/api/trips/{tripId}/reviews',
      '/api/users',
      '/api/users/me',
      '/api/users/me/account-deletion',
      '/api/users/me/account-deletion/confirm',
      '/api/users/me/account-deletion/verify',
      '/api/users/me/active-mode',
      '/api/users/me/consents',
      '/api/users/me/consents/location',
      '/api/users/me/conversations',
      '/api/users/me/driver-declaration',
      '/api/users/me/driver-status',
      '/api/users/me/incidents',
      '/api/users/me/legal-acceptances',
      '/api/users/me/legal-documents/pending',
      '/api/users/me/notifications',
      '/api/users/me/notifications/read',
      '/api/users/me/pending-reviews',
      '/api/users/me/phone-verification',
      '/api/users/me/phone-verification/confirm',
      '/api/users/me/profiles/{profile}',
      '/api/users/me/publishing-status',
      '/api/users/me/requesting-status',
      '/api/users/me/requests',
      '/api/users/me/reviews',
      '/api/users/me/trips',
      '/api/users/{id}',
      '/api/users/{id}/driver-rating',
      '/api/users/{id}/driver-reviews',
      '/api/users/{id}/profiles/{profile}',
      '/api/vehicles',
      '/api/vehicles/{id}',
      '/api/vehicles/{id}/declaration',
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
