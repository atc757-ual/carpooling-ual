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

// Un código de 6 cifras distinto del correcto
function wrongCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

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
    await register().expect(202);
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

  function login(email: string, password: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
  }

  function sentToAna(): number {
    return testMailbox(app).sentTo(ANA).length;
  }

  // Como si el código se hubiera enviado hace más de un minuto
  async function backdateCode(): Promise<void> {
    await dataSource.query(
      `UPDATE pending_registrations
          SET code_sent_at = now() - interval '2 minutes'
        WHERE email = $1`,
      [ANA],
    );
  }

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
    const response = await login(`${EMAIL_PREFIX}ana@ual.es`, PASSWORD).expect(
      200,
    );
    const { refreshToken } = response.body as { refreshToken: string };
    return refreshToken;
  }

  // Fila del registro pendiente de ese correo (o undefined si no hay)
  async function pendingRow<T>(
    columns: string,
    email = ANA,
  ): Promise<T | undefined> {
    const [row] = await dataSource.query<T[]>(
      `SELECT ${columns} FROM pending_registrations WHERE email = $1`,
      [email],
    );
    return row;
  }

  async function countUsers(email = ANA): Promise<number> {
    const [{ count }] = await dataSource.query<{ count: number }[]>(
      'SELECT count(*)::int AS count FROM users WHERE email = $1',
      [email],
    );
    return count;
  }

  // La cuenta solo se crea al verificar el correo: hasta entonces, el registro
  // queda pendiente
  describe('POST /api/auth/register', () => {
    it('saves a pending registration without creating the user: 202 and no body', async () => {
      const response = await register().expect(202);

      expect(response.body).toEqual({});
      expect(response.headers.location).toBeUndefined();
      expect(await countUsers()).toBe(0);
      expect(await pendingRow('name')).toEqual({ name: 'Ana' });
    });

    it('creates the user as a passenger when the code is verified', async () => {
      await register().expect(202);

      const response = await verify(lastCodeSentTo(app, ANA)).expect(200);

      expect(response.body).toMatchObject({
        user: {
          name: 'Ana',
          email: ANA,
          phone: TEST_PHONE,
          profiles: ['passenger'],
        },
      });
      expect(JSON.stringify(response.body)).not.toContain('password');
      expect(await countUsers()).toBe(1);
      expect(await pendingRow('id')).toBeUndefined();
    });

    it('stores when the terms were accepted (proof of consent)', async () => {
      const before = Date.now();
      await registerVerified();

      const [row] = await dataSource.query<{ terms_accepted_at: Date }[]>(
        'SELECT terms_accepted_at FROM users WHERE email = $1',
        [ANA],
      );
      expect(row.terms_accepted_at.getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
    });

    it.each([
      ['with accents and ñ', 'María Núñez', 'María Núñez'],
      ['with a hyphen', 'Ana-María', 'Ana-María'],
      ['with an apostrophe', "Seán O'Connor", "Seán O'Connor"],
      ['with extra spaces', '  Ana   García ', 'Ana García'],
      // «a» + tilde suelta (dos caracteres): se guarda como «á»
      ['with a separate accent', 'María', 'María'],
    ])('accepts a name %s', async (_case, name, stored) => {
      await register({ name }).expect(202);

      expect(await pendingRow('name')).toEqual({ name: stored });
    });

    it.each([
      ['with numbers', 'Ana 2'],
      ['with symbols', 'Ana_García!'],
      ['starting with a hyphen', '-Ana'],
      ['with two hyphens in a row', 'Ana--María'],
    ])('rejects a name %s with 400', async (_case, name) => {
      const response = await register({ name }).expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fields: [{ field: 'name' }],
      });
    });

    it('stores the phone without spaces, dashes or parentheses', async () => {
      await register({ phone: '+34 (600) 12-34-56' }).expect(202);

      expect(await pendingRow('phone')).toEqual({ phone: '+34600123456' });
    });

    it('does not put the phone in the user.registered event (minimisation)', async () => {
      await registerVerified();

      const [event] = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events
          WHERE type = 'user.registered'
            AND source_entity_id = (SELECT id FROM users WHERE email = $1)`,
        [ANA],
      );
      expect(event.payload).toEqual({ profiles: ['passenger'] });
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

    it('rejects the email of an existing account with 409', async () => {
      await registerVerified();

      const response = await register({
        email: `${EMAIL_PREFIX}ANA@UAL.ES`,
      }).expect(409);

      expect(response.body).toMatchObject({
        '@type': 'Error',
        code: 'EMAIL_ALREADY_REGISTERED',
        status: '409',
      });
    });

    it('lets someone register again while the email is not verified', async () => {
      await register().expect(202);

      await register({ name: 'Ana María' }).expect(202);

      // Un solo registro pendiente, con los datos nuevos
      const rows = await dataSource.query<{ name: string }[]>(
        'SELECT name FROM pending_registrations WHERE email = $1',
        [ANA],
      );
      expect(rows).toEqual([{ name: 'Ana María' }]);
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
  // un reenvío por minuto; el registro pendiente dura 24 horas)
  describe('email verification', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('sends the code by email after registering', async () => {
      const before = sentToAna();

      await register().expect(202);

      expect(sentToAna()).toBe(before + 1);
      const mail = testMailbox(app).lastSentTo(ANA);
      expect(mail?.subject).toBe('Tu código de verificación de Carpooling UAL');
      expect(mail?.text).toMatch(/\b\d{6}\b/);
      expect(mail?.text).toContain('Caduca en 15 minutos.');
    });

    it('never stores the code in clear', async () => {
      await register().expect(202);
      const code = lastCodeSentTo(app, ANA);

      const row = await pendingRow<{ code_hash: string }>('code_hash');
      expect(row?.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row?.code_hash).not.toContain(code);
    });

    it('verifies the email with the right code and opens a session', async () => {
      await register().expect(202);

      const response = await verify(lastCodeSentTo(app, ANA)).expect(200);

      expect(response.body).toMatchObject({
        '@type': 'AccessToken',
        tokenType: 'Bearer',
        user: { email: ANA, profiles: ['passenger'] },
      });
      const [user] = await dataSource.query<
        { email_verified_at: Date | null }[]
      >('SELECT email_verified_at FROM users WHERE email = $1', [ANA]);
      expect(user.email_verified_at).not.toBeNull();
      // Y a partir de ahora puede iniciar sesión
      await login(ANA, PASSWORD).expect(200);
    });

    it('rejects a wrong code with 400 and counts the attempt', async () => {
      await register().expect(202);

      const response = await verify(wrongCode(lastCodeSentTo(app, ANA))).expect(
        400,
      );

      expect(response.body).toMatchObject({
        '@type': 'Error',
        code: 'INVALID_VERIFICATION_CODE',
      });
      expect(await pendingRow('failed_attempts')).toEqual({
        failed_attempts: 1,
      });
      expect(await countUsers()).toBe(0);
    });

    it('cancels the code after 3 wrong attempts (429)', async () => {
      await register().expect(202);
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
      await register().expect(202);
      await dataSource.query(
        `UPDATE pending_registrations
            SET code_expires_at = now() - interval '1 second'
          WHERE email = $1`,
        [ANA],
      );

      const response = await verify(lastCodeSentTo(app, ANA)).expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
    });

    it('forgets a registration not verified within 24 hours', async () => {
      await register().expect(202);
      const code = lastCodeSentTo(app, ANA);
      await dataSource.query(
        `UPDATE pending_registrations
            SET created_at = now() - interval '25 hours',
                code_sent_at = now() - interval '25 hours'
          WHERE email = $1`,
        [ANA],
      );
      const before = sentToAna();

      await verify(code).expect(400);
      await resend().expect(202);

      expect(sentToAna()).toBe(before);
    });

    it('does not accept the same code twice', async () => {
      await register().expect(202);
      const code = lastCodeSentTo(app, ANA);
      await verify(code).expect(200);

      const response = await verify(code).expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
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
      await register().expect(202);
      const before = sentToAna();

      await resend().expect(202);

      expect(sentToAna()).toBe(before);
    });

    it('registering again within a minute keeps the code already sent', async () => {
      await register().expect(202);
      const code = lastCodeSentTo(app, ANA);
      const before = sentToAna();

      await register().expect(202);

      expect(sentToAna()).toBe(before);
      await verify(code).expect(200);
    });

    it('resends a new code after a minute and cancels the previous one', async () => {
      await register().expect(202);
      const oldCode = lastCodeSentTo(app, ANA);
      await backdateCode();

      await resend().expect(202);
      const newCode = lastCodeSentTo(app, ANA);

      // El anterior ya no vale y el nuevo sí (que coincidan por azar es 1
      // entre un millón)
      const old = await verify(oldCode).expect(400);
      const session = await verify(newCode).expect(200);

      expect(old.body).toMatchObject({ code: 'INVALID_VERIFICATION_CODE' });
      expect(session.body).toMatchObject({ '@type': 'AccessToken' });
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

      await register().expect(202);

      // Puede pedir otro código pasado el minuto
      await backdateCode();
      await resend().expect(202);
      const session = await verify(lastCodeSentTo(app, ANA)).expect(200);

      expect(session.body).toMatchObject({
        '@type': 'AccessToken',
        user: { email: ANA },
      });
    });

    it('does not let in a pending registration: there is no account yet (401)', async () => {
      await register().expect(202);

      const response = await login(ANA, PASSWORD).expect(401);

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
        user: { '@type': 'User', phone: TEST_PHONE, profiles: ['passenger'] },
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
      await registerVerified();

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
