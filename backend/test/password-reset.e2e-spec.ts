import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { lastCodeSentTo, registerUser, testMailbox } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Recuperación de la contraseña (RF-26) de punta a punta: pedir el código,
// comprobarlo y elegir la contraseña nueva. Los usuarios llevan el prefijo
// EMAIL_PREFIX y se borran después de cada test
const EMAIL_PREFIX = 'password-reset-e2e-';
const ANA = `${EMAIL_PREFIX}ana@ual.es`;
const PASSWORD = 'secret-password';
const NEW_PASSWORD = 'new-secret-password';
const SUBJECT = 'Tu código para cambiar la contraseña de Carpooling UAL';

describe('Password reset API (e2e)', () => {
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

  beforeEach(async () => {
    await registerUser(app, {
      name: 'Ana',
      email: ANA,
      password: PASSWORD,
      profiles: [],
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  function requestCode(email = ANA): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/password-reset')
      .send({ email });
  }

  function checkCode(code: string, email = ANA): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/password-reset/verify')
      .send({ email, code });
  }

  function confirm(
    code: string,
    password = NEW_PASSWORD,
    refreshToken?: string,
  ): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/password-reset/confirm')
      .send({
        email: ANA,
        code,
        password,
        ...(refreshToken ? { refreshToken } : {}),
      });
  }

  function login(password: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ANA, password });
  }

  // El código de recuperación (no el de verificación del registro)
  async function requestAndReadCode(): Promise<string> {
    await requestCode().expect(202);
    expect(testMailbox(app).lastSentTo(ANA)?.subject).toBe(SUBJECT);
    return lastCodeSentTo(app, ANA);
  }

  function wrongCode(code: string): string {
    return code === '000000' ? '000001' : '000000';
  }

  // Como si el código se hubiera enviado hace más de un minuto
  async function backdateCode(): Promise<void> {
    await dataSource.query(
      `UPDATE email_codes SET created_at = now() - interval '2 minutes'
        WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [ANA],
    );
  }

  describe('POST /api/auth/password-reset', () => {
    it('sends a code to an existing account (202)', async () => {
      const code = await requestAndReadCode();

      expect(code).toMatch(/^\d{6}$/);
      expect(testMailbox(app).lastSentTo(ANA)?.text).toContain(
        'Caduca en 15 minutos.',
      );
    });

    it('answers 202 to an unknown email without sending anything', async () => {
      const unknown = `${EMAIL_PREFIX}nobody@ual.es`;

      await requestCode(unknown).expect(202);

      expect(testMailbox(app).sentTo(unknown)).toHaveLength(0);
    });

    it('sends at most one code a minute', async () => {
      await requestCode().expect(202);
      const before = testMailbox(app).sentTo(ANA).length;

      await requestCode().expect(202);

      expect(testMailbox(app).sentTo(ANA)).toHaveLength(before);
    });

    it('resends a new code after a minute and cancels the previous one', async () => {
      const oldCode = await requestAndReadCode();
      await backdateCode();

      const newCode = await requestAndReadCode();

      await checkCode(oldCode).expect(400);
      await checkCode(newCode).expect(204);
    });

    it('validates the email', async () => {
      const response = await requestCode('not-an-email').expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fields: [{ field: 'email' }],
      });
    });
  });

  describe('POST /api/auth/password-reset/verify', () => {
    it('accepts the right code without using it up', async () => {
      const code = await requestAndReadCode();

      await checkCode(code).expect(204);

      // Sigue valiendo para cambiar la contraseña
      await confirm(code).expect(204);
    });

    it('rejects a wrong code with 400', async () => {
      const code = await requestAndReadCode();

      const response = await checkCode(wrongCode(code)).expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
    });

    it('cancels the code after 3 wrong attempts (429)', async () => {
      const code = await requestAndReadCode();

      await checkCode(wrongCode(code)).expect(400);
      await checkCode(wrongCode(code)).expect(400);
      const third = await checkCode(wrongCode(code)).expect(429);

      expect(third.body).toMatchObject({ code: 'TOO_MANY_ATTEMPTS' });
      await checkCode(code).expect(400);
    });

    it('rejects an expired code', async () => {
      const code = await requestAndReadCode();
      await dataSource.query(
        `UPDATE email_codes SET expires_at = now() - interval '1 second'
          WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [ANA],
      );

      await checkCode(code).expect(400);
    });

    it('answers an unknown email like a wrong code', async () => {
      const response = await checkCode(
        '123456',
        `${EMAIL_PREFIX}nobody@ual.es`,
      ).expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
    });
  });

  describe('POST /api/auth/password-reset/confirm', () => {
    it('changes the password: the old one stops working and the new one works', async () => {
      const code = await requestAndReadCode();

      await confirm(code).expect(204);

      await login(PASSWORD).expect(401);
      await login(NEW_PASSWORD).expect(200);
    });

    it('closes every open session', async () => {
      const session = await login(PASSWORD).expect(200);
      const { refreshToken } = session.body as { refreshToken: string };
      const code = await requestAndReadCode();

      await confirm(code).expect(204);

      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
      expect(response.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });

    it('keeps the current session and closes every other session when refreshToken is provided', async () => {
      const currentSession = await login(PASSWORD).expect(200);
      const otherSession = await login(PASSWORD).expect(200);
      const { refreshToken: currentRefreshToken } = currentSession.body as {
        refreshToken: string;
      };
      const { refreshToken: otherRefreshToken } = otherSession.body as {
        refreshToken: string;
      };
      const code = await requestAndReadCode();

      await confirm(code, NEW_PASSWORD, currentRefreshToken).expect(204);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: otherRefreshToken })
        .expect(401)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' }),
        );

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: currentRefreshToken })
        .expect(200);
    });

    it('does not accept the same code twice', async () => {
      const code = await requestAndReadCode();
      await confirm(code).expect(204);

      const response = await confirm(code, 'another-password').expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
    });

    it('rejects the current password and keeps the code', async () => {
      const code = await requestAndReadCode();

      const response = await confirm(code, PASSWORD).expect(400);

      expect(response.body).toMatchObject({
        '@type': 'Error',
        code: 'PASSWORD_UNCHANGED',
        status: '400',
      });
      // El código no se ha gastado: puede elegir otra
      await confirm(code).expect(204);
    });

    it('does not tell whether a password is the current one without the right code', async () => {
      const code = await requestAndReadCode();

      const response = await confirm(wrongCode(code), PASSWORD).expect(400);

      expect(response.body).toMatchObject({
        code: 'INVALID_VERIFICATION_CODE',
      });
    });

    it('validates the new password like the registration', async () => {
      const code = await requestAndReadCode();

      const response = await confirm(code, 'short').expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fields: [{ field: 'password' }],
      });
    });
  });
});
