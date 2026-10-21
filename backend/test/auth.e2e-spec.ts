import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Prueba la API de auth de punta a punta: HTTP → validación → AuthService →
// base de datos real. Los usuarios llevan el prefijo EMAIL_PREFIX y se borran
// después de cada test
const EMAIL_PREFIX = 'auth-e2e-';
const PASSWORD = 'secret-password';

describe('Auth API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `${EMAIL_PREFIX}%`,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  function register(overrides: object = {}): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        name: 'Ana',
        email: `${EMAIL_PREFIX}ana@ual.es`,
        password: PASSWORD,
        profiles: ['driver', 'passenger'],
        ...overrides,
      });
  }

  function login(email: string, password: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  describe('POST /api/auth/register', () => {
    it('creates the user: 201, Location and the TMF User resource', async () => {
      const response = await register().expect(201);

      const body = response.body as { id: string };
      expect(response.body).toEqual({
        '@type': 'User',
        id: body.id,
        href: `/api/users/${body.id}`,
        name: 'Ana',
        email: `${EMAIL_PREFIX}ana@ual.es`,
        profiles: ['driver', 'passenger'],
      });
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers.location).toBe(`/api/users/${body.id}`);
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('rejects an already registered email with 409', async () => {
      await register().expect(201);

      const response = await register({
        email: `${EMAIL_PREFIX}ANA@UAL.ES`,
      }).expect(409);

      expect(response.body).toMatchObject({
        '@type': 'Error',
        code: 'EMAIL_ALREADY_REGISTERED',
        status: '409',
      });
    });

    it('rejects a non-UAL email with 400', async () => {
      const response = await register({
        email: `${EMAIL_PREFIX}ana@gmail.com`,
      }).expect(400);

      expect(response.body).toMatchObject({
        code: 'EMAIL_DOMAIN_NOT_ALLOWED',
      });
    });

    it('reports every invalid field at once', async () => {
      const response = await register({
        name: '   ',
        email: 'not-an-email',
        password: 'short',
        profiles: ['admin'],
      }).expect(400);

      const body = response.body as { fields: { field: string }[] };
      expect(response.body).toMatchObject({
        '@type': 'ValidationError',
        code: 'VALIDATION_FAILED',
      });
      expect(new Set(body.fields.map(({ field }) => field))).toEqual(
        new Set(['name', 'email', 'password', 'profiles']),
      );
    });

    it('does not let a client add unexpected fields', async () => {
      const response = await register({ isAdmin: true }).expect(400);

      expect(response.body).toMatchObject({
        fields: [{ field: 'isAdmin' }],
      });
    });
  });

  describe('POST /api/auth/login and GET /api/auth/me', () => {
    it('logs in and uses the token to get the current user', async () => {
      await register().expect(201);

      const loginResponse = await login(
        `${EMAIL_PREFIX}ana@ual.es`,
        PASSWORD,
      ).expect(200);
      const { accessToken } = loginResponse.body as { accessToken: string };
      expect(loginResponse.body).toMatchObject({
        '@type': 'AccessToken',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { '@type': 'User', profiles: ['driver', 'passenger'] },
      });

      const meResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(meResponse.body).toMatchObject({
        '@type': 'User',
        email: `${EMAIL_PREFIX}ana@ual.es`,
      });
    });

    it.each([
      ['a wrong password', `${EMAIL_PREFIX}ana@ual.es`, 'wrong-password'],
      ['an unknown email', `${EMAIL_PREFIX}nobody@ual.es`, PASSWORD],
    ])('answers %s with the same 401', async (_case, email, password) => {
      await register().expect(201);

      const response = await login(email, password).expect(401);

      expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('protects /me: without a token answers 401', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
    });
  });

  describe('POST /api/auth/refresh and POST /api/auth/logout', () => {
    function refresh(refreshToken: unknown): request.Test {
      return request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken });
    }

    function logout(refreshToken: string): request.Test {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken });
    }

    async function loginRefreshToken(): Promise<string> {
      await register().expect(201);
      const response = await login(
        `${EMAIL_PREFIX}ana@ual.es`,
        PASSWORD,
      ).expect(200);
      const { refreshToken } = response.body as { refreshToken: string };
      return refreshToken;
    }

    it('login returns a refresh token valid for 7 days', async () => {
      await register().expect(201);

      const response = await login(
        `${EMAIL_PREFIX}ana@ual.es`,
        PASSWORD,
      ).expect(200);

      const body = response.body as { refreshTokenExpiresAt: string };
      expect(response.body).toMatchObject({
        refreshToken: expect.stringMatching(/^[\w-]{43}$/) as string,
      });
      const daysLeft =
        (Date.parse(body.refreshTokenExpiresAt) - Date.now()) /
        (24 * 60 * 60 * 1000);
      expect(daysLeft).toBeCloseTo(7, 1);
    });

    it('renews the session with new tokens', async () => {
      const refreshToken = await loginRefreshToken();

      const response = await refresh(refreshToken).expect(200);

      const body = response.body as {
        accessToken: string;
        refreshToken: string;
      };
      expect(response.body).toMatchObject({
        '@type': 'AccessToken',
        user: { email: `${EMAIL_PREFIX}ana@ual.es` },
      });
      expect(body.refreshToken).not.toBe(refreshToken);
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${body.accessToken}`)
        .expect(200);
    });

    it('closes the session when an already used refresh token comes back', async () => {
      const stolen = await loginRefreshToken();
      const response = await refresh(stolen).expect(200);
      const { refreshToken: current } = response.body as {
        refreshToken: string;
      };

      const reuse = await refresh(stolen).expect(401);

      expect(reuse.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      await refresh(current).expect(401);
    });

    it('logs out with 204 and the refresh token stops working', async () => {
      const refreshToken = await loginRefreshToken();

      const logoutResponse = await logout(refreshToken).expect(204);

      expect(logoutResponse.body).toEqual({});
      const response = await refresh(refreshToken).expect(401);
      expect(response.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });

    it('answers 204 to a logout with an unknown token', async () => {
      const response = await logout('not-a-real-token').expect(204);

      expect(response.body).toEqual({});
    });

    it('validates the body: refreshToken is required', async () => {
      const response = await refresh(undefined).expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fields: expect.arrayContaining([
          expect.objectContaining({ field: 'refreshToken' }),
        ]) as unknown,
      });
    });
  });
});
