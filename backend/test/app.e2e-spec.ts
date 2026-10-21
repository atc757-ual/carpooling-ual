import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Usa la base de datos real: requiere docker compose up -d (en el CI, el
  // servicio postgres del workflow)
  it('GET /api/health responds 200 with the database up', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toMatchObject({
      '@type': 'Health',
      status: 'ok',
      database: 'up',
    });
  });

  it('serves routes only under the /api prefix', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  describe('TMF630', () => {
    it('adds a generated X-Request-Id to every response', async () => {
      const response = await request(app.getHttpServer()).get('/api/health');

      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reuses the X-Request-Id sent by the client', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .set('X-Request-Id', 'frontend-123');

      expect(response.headers['x-request-id']).toBe('frontend-123');
    });

    it('answers an unknown route with a TMF Error', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/nothing-here')
        .expect(404);

      expect(response.body).toEqual({
        '@type': 'Error',
        code: 'NOT_FOUND',
        reason: 'Not found',
        message: 'Cannot GET /api/nothing-here',
        status: '404',
      });
    });
  });
});
