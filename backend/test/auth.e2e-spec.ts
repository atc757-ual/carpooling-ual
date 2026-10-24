import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { lastCodeSentTo, TEST_PHONE, testMailbox } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Prueba la API de auth de punta a punta: HTTP → validación → AuthService →
// base de datos real. Los usuarios llevan el prefijo EMAIL_PREFIX y se borran
// después de cada test
const EMAIL_PREFIX = 'auth-e2e-';
const PASSWORD = 'secret-password';
const ANA = `${EMAIL_PREFIX}ana@ual.es`;

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
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
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
        phone: TEST_PHONE,
        acceptedTerms: true,
        ...overrides,
      });
  }

  // Registro y verificación del correo con el código recibido (para poder
  // iniciar sesión)
  async function registerVerified(): Promise<void> {
    await register().expect(201);
    await verify(lastCodeSentTo(app, ANA)).expect(200);
  }

  function verify(code: string, email = ANA): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/verify-email')
      .send({ email, code });
  }

  function resend(email = ANA): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/verify-email/resend')
      .send({ email });
  }

  // Un código de 6 cifras distinto del correcto
  function wrongCode(code: string): string {
    return code === '000000' ? '000001' : '000000';
  }

  function login(email: string, password: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  describe('POST /api/auth/register', () => {
    it('creates the user without profiles: 201, Location and the TMF User resource', async () => {
      const response = await register().expect(201);

      const body = response.body as { id: string };
      expect(response.body).toEqual({
        '@type': 'User',
        id: body.id,
        href: `/api/users/${body.id}`,
        name: 'Ana',
        email: `${EMAIL_PREFIX}ana@ual.es`,
        phone: TEST_PHONE,
        profiles: [],
      });
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.headers.location).toBe(`/api/users/${body.id}`);
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('stores when the terms were accepted (proof of consent)', async () => {
      const before = Date.now();
      const response = await register().expect(201);

      const [row] = await dataSource.query<{ terms_accepted_at: Date }[]>(
        'SELECT terms_accepted_at FROM users WHERE id = $1',
        [(response.body as { id: string }).id],
      );
      expect(row.terms_accepted_at.getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
    });

    it('stores the phone without spaces, dashes or parentheses', async () => {
      const response = await register({ phone: '+34 (600) 12-34-56' }).expect(
        201,
      );

      expect(response.body).toMatchObject({ phone: '+34600123456' });
    });

    it('does not put the phone in the user.registered event (minimisation)', async () => {
      const response = await register().expect(201);

      const [event] = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events
          WHERE type = 'user.registered' AND source_entity_id = $1`,
        [(response.body as { id: string }).id],
      );
      expect(event.payload).toEqual({ profiles: [] });
    });

    it.each([
      ['without the country code', '600123456'],
      ['too short', '+34123'],
      ['with letters', '+34abc123456'],
      ['missing', undefined],
    ])('rejects a phone %s with 400', async (_case, phone) => {
      const response = await register({ phone }).expect(400);

      // Solo falla el teléfono (sin él, con varios motivos a la vez)
      const body = response.body as {
        code: string;
        fields: { field: string }[];
      };
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(new Set(body.fields.map(({ field }) => field))).toEqual(
        new Set(['phone']),
      );
    });

    it.each([
      ['not accepted', false],
      ['missing', undefined],
      ['not a boolean', 'yes'],
    ])('rejects terms %s with 400', async (_case, acceptedTerms) => {
      const response = await register({ acceptedTerms }).expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fields: [{ field: 'acceptedTerms' }],
      });
    });

    it('no longer accepts profiles: they are chosen after registering', async () => {
      const response = await register({ profiles: ['passenger'] }).expect(400);

      expect(response.body).toMatchObject({ fields: [{ field: 'profiles' }] });
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
        phone: '123',
      }).expect(400);

      const body = response.body as { fields: { field: string }[] };
      expect(response.body).toMatchObject({
        '@type': 'ValidationError',
        code: 'VALIDATION_FAILED',
      });
      expect(new Set(body.fields.map(({ field }) => field))).toEqual(
        new Set(['name', 'email', 'password', 'phone']),
      );
    });

    it('does not let a client add unexpected fields', async () => {
      const response = await register({ isAdmin: true }).expect(400);

      expect(response.body).toMatchObject({
        fields: [{ field: 'isAdmin' }],
      });
    });
  });

  // Verificación del correo con un código de 6 cifras (15 minutos, 3 intentos,
  // un reenvío por minuto)
  describe('email verification', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    function sentToAna(): number {
      return testMailbox(app).sentTo(ANA).length;
    }

    // Como si el código se hubiera enviado hace más de un minuto
    async function backdateCode(): Promise<void> {
      await dataSource.query(
        `UPDATE email_codes SET created_at = now() - interval '2 minutes'
          WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [ANA],
      );
    }

    it('sends the code by email after registering', async () => {
      const before = sentToAna();

      await register().expect(201);

      expect(sentToAna()).toBe(before + 1);
      const mail = testMailbox(app).lastSentTo(ANA);
      expect(mail?.subject).toBe('Tu código de verificación de Carpooling UAL');
      expect(mail?.text).toMatch(/\b\d{6}\b/);
      expect(mail?.text).toContain('Caduca en 15 minutos.');
    });

    it('never stores the code in clear', async () => {
      await register().expect(201);
      const code = lastCodeSentTo(app, ANA);

      const [row] = await dataSource.query<{ code_hash: string }[]>(
        `SELECT code_hash FROM email_codes
          WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [ANA],
      );
      expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.code_hash).not.toContain(code);
    });

    it('verifies the email with the right code and opens a session', async () => {
      await register().expect(201);

      const response = await verify(lastCodeSentTo(app, ANA)).expect(200);

      expect(response.body).toMatchObject({
        '@type': 'AccessToken',
        tokenType: 'Bearer',
        user: { email: ANA, profiles: [] },
      });
      const [user] = await dataSource.query<
        { id: string; email_verified_at: Date | null }[]
      >('SELECT id, email_verified_at FROM users WHERE email = $1', [ANA]);
      expect(user.email_verified_at).not.toBeNull();
      const events = await dataSource.query<unknown[]>(
        `SELECT 1 FROM events
          WHERE type = 'user.email_verified' AND source_entity_id = $1`,
        [user.id],
      );
      expect(events).toHaveLength(1);
      // Y a partir de ahora puede iniciar sesión
      await login(ANA, PASSWORD).expect(200);
    });

    it('rejects a wrong code with 400 and counts the attempt', async () => {
      await register().expect(201);

      const response = await verify(wrongCode(lastCodeSentTo(app, ANA))).expect(
        400,
      );

      expect(response.body).toMatchObject({
        '@type': 'Error',
        code: 'INVALID_VERIFICATION_CODE',
      });
      const [row] = await dataSource.query<{ failed_attempts: number }[]>(
        `SELECT failed_attempts FROM email_codes
          WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [ANA],
      );
      expect(row.failed_attempts).toBe(1);
    });

    it('cancels the code after 3 wrong attempts (429)', async () => {
      await register().expect(201);
      const code = lastCodeSentTo(app, ANA);

      await verify(wrongCode(code)).expect(400);
      await verify(wrongCode(code)).expect(400);
      const third = await verify(wrongCode(code)).expect(429);

      expect(third.body).toMatchObject({
        code: 'TOO_MANY_ATTEMPTS',
        status: '429',
      });
      // Ya no sirve ni el correcto: hay que pedir otro
      await verify(code).expect(400);
    });

    it('rejects an expired code', async () => {
      await register().expect(201);
      await dataSource.query(
        `UPDATE email_codes SET expires_at = now() - interval '1 second'
          WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [ANA],
      );

      const response = await verify(lastCodeSentTo(app, ANA)).expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
    });

    it('does not accept the same code twice', async () => {
      await register().expect(201);
      const code = lastCodeSentTo(app, ANA);
      await verify(code).expect(200);

      await verify(code).expect(400);
    });

    it('answers an unknown email like a wrong code', async () => {
      const response = await verify(
        '123456',
        `${EMAIL_PREFIX}nobody@ual.es`,
      ).expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
    });

    it.each(['12345', '1234567', 'abcdef', 123456])(
      'validates the code format (%p)',
      async (code) => {
        const response = await request(app.getHttpServer())
          .post('/api/auth/verify-email')
          .send({ email: ANA, code })
          .expect(400);

        expect(response.body).toMatchObject({
          code: 'VALIDATION_FAILED',
          fields: [{ field: 'code' }],
        });
      },
    );

    it('resends at most once a minute, always answering 202', async () => {
      await register().expect(201);
      const before = sentToAna();

      await resend().expect(202);

      expect(sentToAna()).toBe(before);
    });

    it('resends a new code after a minute and cancels the previous one', async () => {
      await register().expect(201);
      const oldCode = lastCodeSentTo(app, ANA);
      await backdateCode();

      await resend().expect(202);
      const newCode = lastCodeSentTo(app, ANA);

      if (newCode !== oldCode) {
        await verify(oldCode).expect(400);
      }
      await verify(newCode).expect(200);
    });

    it('answers 202 to an unknown email without sending anything', async () => {
      const unknown = `${EMAIL_PREFIX}nobody@ual.es`;

      await resend(unknown).expect(202);

      expect(testMailbox(app).sentTo(unknown)).toHaveLength(0);
    });

    it('keeps the registration if the email cannot be sent', async () => {
      jest
        .spyOn(testMailbox(app), 'send')
        .mockRejectedValueOnce(new Error('SMTP server down'));

      await register().expect(201);

      // Puede pedir otro código pasado el minuto
      await backdateCode();
      await resend().expect(202);
      await verify(lastCodeSentTo(app, ANA)).expect(200);
    });

    it('does not let in an unverified user with the right password (403)', async () => {
      await register().expect(201);

      const response = await login(ANA, PASSWORD).expect(403);

      expect(response.body).toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
        status: '403',
      });
    });

    it('answers 401 to a wrong password, verified or not', async () => {
      await register().expect(201);

      const response = await login(ANA, 'wrong-password').expect(401);

      expect(response.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('POST /api/auth/login and GET /api/auth/me', () => {
    it('logs in and uses the token to get the current user', async () => {
      await registerVerified();

      const loginResponse = await login(
        `${EMAIL_PREFIX}ana@ual.es`,
        PASSWORD,
      ).expect(200);
      const { accessToken } = loginResponse.body as { accessToken: string };
      expect(loginResponse.body).toMatchObject({
        '@type': 'AccessToken',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: { '@type': 'User', phone: TEST_PHONE, profiles: [] },
      });

      const meResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      expect(meResponse.body).toMatchObject({
        '@type': 'User',
        email: `${EMAIL_PREFIX}ana@ual.es`,
        phone: TEST_PHONE,
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
      await registerVerified();
      const response = await login(
        `${EMAIL_PREFIX}ana@ual.es`,
        PASSWORD,
      ).expect(200);
      const { refreshToken } = response.body as { refreshToken: string };
      return refreshToken;
    }

    it('login returns a refresh token valid for 7 days', async () => {
      await registerVerified();

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
