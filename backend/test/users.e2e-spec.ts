import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { computeConsentFingerprint } from '../src/modules/users/user-consent';
import { deleteTestUsers } from './support/cleanup';
import {
  lastCodeSentTo,
  lastSmsCodeSentTo,
  registerUser,
  TEST_PHONE,
  testSmsBox,
} from './support/accounts';

// GET /api/users/{id} de punta a punta, con permisos por perfil (RNF-04).
// Los usuarios llevan el prefijo EMAIL_PREFIX y se borran después de cada test
const EMAIL_PREFIX = 'users-e2e-';
const PASSWORD = 'secret-password';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

interface TestUser {
  id: string;
  accessToken: string;
}

describe('Users API (e2e)', () => {
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

  // Registra un usuario y, si se pide, le da el perfil de administrador
  // directamente en la base de datos (el alta de admins llega con RF-25);
  // después inicia sesión para que el token incluya sus perfiles
  async function createUser(name: string, isAdmin = false): Promise<TestUser> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    const id = await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles: ['passenger'],
    });
    if (isAdmin) {
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [id],
      );
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const { accessToken } = login.body as { accessToken: string };
    return { id, accessToken };
  }

  function updateMe(body: object, accessToken: string): request.Test {
    return request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);
  }

  function setMode(mode: string, accessToken: string): request.Test {
    return request(app.getHttpServer())
      .put('/api/users/me/active-mode')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ mode });
  }

  function getUser(id: string, accessToken?: string): request.Test {
    const req = request(app.getHttpServer()).get(`/api/users/${id}`);
    return accessToken
      ? req.set('Authorization', `Bearer ${accessToken}`)
      : req;
  }

  it('lets users get their own data (the href of the register works)', async () => {
    const ana = await createUser('ana');

    const response = await getUser(ana.id, ana.accessToken).expect(200);

    expect(response.body).toEqual({
      '@type': 'User',
      id: ana.id,
      href: `/api/users/${ana.id}`,
      name: 'ana',
      email: `${EMAIL_PREFIX}ana@ual.es`,
      phone: TEST_PHONE,
      phoneVerified: false,
      profiles: ['passenger'],
      activeMode: null,
      timeToleranceMin: 15,
      avatarKey: null,
      bio: null,
      preferences: {
        conversation: null,
        music: null,
        smoking: null,
        pets: null,
      },
    });
  });

  it('lets users get their own account and public profile at GET /api/users/me', async () => {
    const ana = await createUser('ana');

    const response = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${ana.accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      '@type': 'User',
      id: ana.id,
      avatarKey: null,
      bio: null,
      preferences: {
        conversation: null,
        music: null,
        smoking: null,
        pets: null,
      },
    });
  });

  describe('GET /api/avatars', () => {
    it('lists the 12 SVG avatars in display order and gets one by key', async () => {
      const ana = await createUser('ana');

      const list = await request(app.getHttpServer())
        .get('/api/avatars')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(200);

      const avatars = list.body as { id: string; svg: string }[];
      expect(avatars).toHaveLength(12);
      expect(avatars[0]).toMatchObject({
        '@type': 'Avatar',
        id: 'sun',
        href: '/api/avatars/sun',
        name: 'Sol de Almería',
      });
      expect(avatars[0].svg).toContain('<svg');
      expect(list.headers['x-total-count']).toBe('12');

      await request(app.getHttpServer())
        .get('/api/avatars/cactus')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ id: 'cactus' }));

      await request(app.getHttpServer())
        .get('/api/avatars/unknown')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(404)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'AVATAR_NOT_FOUND' }),
        );
    });
  });

  it('forbids getting another user without the admin profile (403)', async () => {
    const ana = await createUser('ana');
    const bob = await createUser('bob');

    const response = await getUser(bob.id, ana.accessToken).expect(403);

    expect(response.body).toMatchObject({
      '@type': 'Error',
      code: 'PROFILE_REQUIRED',
      status: '403',
    });
  });

  it('answers 403 and not 404 to a non-admin, so ids cannot be guessed', async () => {
    const ana = await createUser('ana');

    const response = await getUser(UNKNOWN_ID, ana.accessToken).expect(403);

    expect(response.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
  });

  it('lets an administrator get any user', async () => {
    const admin = await createUser('admin', true);
    const bob = await createUser('bob');

    const response = await getUser(bob.id, admin.accessToken).expect(200);

    // Con su teléfono: lo necesita para actuar ante una incidencia
    expect(response.body).toMatchObject({
      '@type': 'UserAdmin',
      id: bob.id,
      name: 'bob',
      phone: TEST_PHONE,
    });
  });

  it('answers 404 USER_NOT_FOUND to an administrator for an unknown id', async () => {
    const admin = await createUser('admin', true);

    const response = await getUser(UNKNOWN_ID, admin.accessToken).expect(404);

    expect(response.body).toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('answers 400 VALIDATION_FAILED when the id is not a UUID', async () => {
    const ana = await createUser('ana');

    const response = await getUser('not-a-uuid', ana.accessToken).expect(400);

    expect(response.body).toMatchObject({
      '@type': 'ValidationError',
      fields: [{ field: 'id', reason: 'id must be a UUID' }],
    });
  });

  it('is protected by default: without a token answers 401', async () => {
    const response = await getUser(UNKNOWN_ID).expect(401);

    expect(response.body).toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
  });

  // Elegir modo después de registrarse (conductor y/o pasajero)
  describe('PUT /api/users/me/profiles/{profile}', () => {
    interface Newcomer extends TestUser {
      refreshToken: string;
    }

    // Recién registrado: sin perfiles, con una sesión abierta
    async function newcomer(name: string): Promise<Newcomer> {
      const email = `${EMAIL_PREFIX}${name}@ual.es`;
      const id = await registerUser(app, {
        name,
        email,
        password: PASSWORD,
        profiles: [],
      });
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      const { accessToken, refreshToken } = login.body as {
        accessToken: string;
        refreshToken: string;
      };
      return { id, accessToken, refreshToken };
    }

    function chooseMode(profile: string, accessToken?: string): request.Test {
      const req = request(app.getHttpServer()).put(
        `/api/users/me/profiles/${profile}`,
      );
      return accessToken
        ? req.set('Authorization', `Bearer ${accessToken}`)
        : req;
    }

    it('activates the passenger profile and then also the driver one', async () => {
      const ana = await newcomer('ana');

      const passenger = await chooseMode('passenger', ana.accessToken).expect(
        200,
      );
      const both = await chooseMode('driver', ana.accessToken).expect(200);

      expect(passenger.body).toMatchObject({
        '@type': 'User',
        id: ana.id,
        profiles: ['passenger'],
      });
      const { profiles } = both.body as { profiles: string[] };
      expect(profiles.sort((a, b) => a.localeCompare(b))).toEqual([
        'driver',
        'passenger',
      ]);
    });

    it('is idempotent: choosing the same mode again changes nothing', async () => {
      const ana = await newcomer('ana');
      await chooseMode('passenger', ana.accessToken).expect(200);

      const response = await chooseMode('passenger', ana.accessToken).expect(
        200,
      );

      expect(response.body).toMatchObject({ profiles: ['passenger'] });
      const events = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events
          WHERE type = 'user.profile_activated' AND source_entity_id = $1`,
        [ana.id],
      );
      // Un único evento, con el propio usuario como autor del cambio
      expect(events).toEqual([
        { payload: { profile: 'passenger', changedBy: ana.id } },
      ]);
    });

    it('survives a double click: two requests at once create one profile', async () => {
      const ana = await newcomer('ana');

      await Promise.all([
        chooseMode('passenger', ana.accessToken).expect(200),
        chooseMode('passenger', ana.accessToken).expect(200),
      ]);

      const rows = await dataSource.query<unknown[]>(
        'SELECT user_id FROM passenger_profiles WHERE user_id = $1',
        [ana.id],
      );
      expect(rows).toHaveLength(1);
    });

    it.each(['admin', 'pilot'])(
      'rejects the mode "%s" with 400',
      async (profile) => {
        const ana = await newcomer('ana');

        const response = await chooseMode(profile, ana.accessToken).expect(400);

        expect(response.body).toMatchObject({
          code: 'VALIDATION_FAILED',
          fields: [{ field: 'profile' }],
        });
      },
    );

    it('answers 404 if the account no longer exists but the token is still valid', async () => {
      const ana = await newcomer('ana');
      await dataSource.query('DELETE FROM users WHERE id = $1', [ana.id]);

      const response = await chooseMode('passenger', ana.accessToken).expect(
        404,
      );

      expect(response.body).toMatchObject({ code: 'USER_NOT_FOUND' });
    });

    it('needs a session: without a token answers 401', async () => {
      const response = await chooseMode('passenger').expect(401);

      expect(response.body).toMatchObject({ code: 'INVALID_ACCESS_TOKEN' });
    });

    it('does not reactivate a profile deactivated by an administrator (409)', async () => {
      const ana = await newcomer('ana');
      await chooseMode('driver', ana.accessToken).expect(200);
      // Lo que hace un administrador con RF-25 (probado en user-admin)
      await dataSource.query(
        'UPDATE driver_profiles SET is_active = false WHERE user_id = $1',
        [ana.id],
      );

      const response = await chooseMode('driver', ana.accessToken).expect(409);

      expect(response.body).toMatchObject({
        '@type': 'Error',
        code: 'PROFILE_DEACTIVATED_BY_ADMIN',
        status: '409',
      });
    });

    it('gives a token with the new profile after refreshing the session', async () => {
      const ana = await newcomer('ana');
      await chooseMode('driver', ana.accessToken).expect(200);

      const refreshed = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: ana.refreshToken })
        .expect(200);
      const { accessToken } = refreshed.body as { accessToken: string };

      expect(refreshed.body).toMatchObject({ user: { profiles: ['driver'] } });
      // El token nuevo ya sirve para una ruta solo de conductores (RF-21)
      await request(app.getHttpServer())
        .get('/api/users/me/driver-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  // El modo con el que se viaja, el mismo en todos los dispositivos
  describe('PUT /api/users/me/active-mode', () => {
    it('keeps the mode and returns it with the user, also on login', async () => {
      const ana = await createUser('ana');
      await request(app.getHttpServer())
        .put('/api/users/me/profiles/driver')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(200);

      const response = await setMode('driver', ana.accessToken).expect(200);

      expect(response.body).toMatchObject({ id: ana.id, activeMode: 'driver' });
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `${EMAIL_PREFIX}ana@ual.es`, password: PASSWORD })
        .expect(200);
      expect(login.body).toMatchObject({ user: { activeMode: 'driver' } });
    });

    it('records one event per change, none when it is the same mode', async () => {
      const ana = await createUser('ana');

      await setMode('passenger', ana.accessToken).expect(200);
      await setMode('passenger', ana.accessToken).expect(200);

      const events = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events
          WHERE type = 'user.active_mode_changed' AND source_entity_id = $1`,
        [ana.id],
      );
      expect(events).toEqual([
        { payload: { activeMode: 'passenger', previousMode: null } },
      ]);
    });

    it('rejects a mode without that active profile', async () => {
      const ana = await createUser('ana');

      const response = await setMode('driver', ana.accessToken).expect(403);

      expect(response.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
    });

    it('rejects an unknown mode', async () => {
      const ana = await createUser('ana');

      const response = await setMode('admin', ana.accessToken).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('starts with no mode', async () => {
      const ana = await createUser('ana');

      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ activeMode: null });
    });
  });

  // Cambiar los datos de la propia cuenta
  describe('PATCH /api/users/me', () => {
    it('changes only the fields sent and records which ones', async () => {
      const ana = await createUser('ana');

      const response = await updateMe(
        {
          name: '  Ana   María ',
          phone: '+34 611 22 33 44',
          timeToleranceMin: 10,
        },
        ana.accessToken,
      ).expect(200);

      expect(response.body).toMatchObject({
        name: 'Ana María',
        email: `${EMAIL_PREFIX}ana@ual.es`,
        phone: '+34611223344',
        timeToleranceMin: 10,
      });
      const events = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events
          WHERE type = 'user.updated' AND source_entity_id = $1`,
        [ana.id],
      );
      // Sin el nombre ni el teléfono: solo qué cambió y la tolerancia
      expect(events).toEqual([
        {
          payload: {
            changedFields: ['name', 'phone', 'timeToleranceMin'],
            timeToleranceMin: 10,
          },
        },
      ]);
    });

    it('records nothing when nothing changes', async () => {
      const ana = await createUser('ana');

      await updateMe({ timeToleranceMin: 15 }, ana.accessToken).expect(200);

      const events = await dataSource.query<unknown[]>(
        `SELECT id FROM events
          WHERE type = 'user.updated' AND source_entity_id = $1`,
        [ana.id],
      );
      expect(events).toHaveLength(0);
    });

    it('updates avatar, bio and travel preferences without storing bio text in the event', async () => {
      const ana = await createUser('ana');
      const bio =
        'Viajo todos los días desde Roquetas de Mar al campus de la UAL.';

      const response = await updateMe(
        {
          avatarKey: 'sun',
          bio: `  ${bio}  `,
          preferences: {
            conversation: 'chatty',
            music: 'soft',
            smoking: 'no',
            pets: 'small_carrier',
          },
        },
        ana.accessToken,
      ).expect(200);

      expect(response.body).toMatchObject({
        avatarKey: 'sun',
        bio,
        preferences: {
          conversation: 'chatty',
          music: 'soft',
          smoking: 'no',
          pets: 'small_carrier',
        },
      });
      const events = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events
          WHERE type = 'user.updated' AND source_entity_id = $1`,
        [ana.id],
      );
      expect(events).toEqual([
        {
          payload: {
            changedFields: ['avatarKey', 'bio', 'preferences'],
            timeToleranceMin: 15,
          },
        },
      ]);
      expect(JSON.stringify(events)).not.toContain('Roquetas');

      // Vaciar «Sobre mí» con cadena vacía y quitar el avatar con null
      const cleared = await updateMe(
        { avatarKey: null, bio: '   ', preferences: { pets: null } },
        ana.accessToken,
      ).expect(200);
      expect(cleared.body).toMatchObject({
        avatarKey: null,
        bio: null,
        preferences: {
          conversation: 'chatty',
          music: 'soft',
          smoking: 'no',
          pets: null,
        },
      });
    });

    it.each([
      [{ timeToleranceMin: 7 }],
      [{ name: 'Ana 2' }],
      [{ phone: '123' }],
      [{ email: 'otra@ual.es' }],
      [{ avatarKey: 'dragon' }],
      [{ bio: 'Demasiado corto' }],
      [{ bio: 'a'.repeat(501) }],
      [{ preferences: { conversation: 'loud' } }],
    ])('rejects %j', async (body) => {
      const ana = await createUser('ana');

      const response = await updateMe(body, ana.accessToken).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  // Prueba del consentimiento (RGPD): condiciones, privacidad y ubicación
  describe('GET /api/users/me/consents and PUT /api/users/me/consents/location', () => {
    it('records initial terms and privacy consents on registration with verifiable SHA-256 fingerprints', async () => {
      const ana = await createUser('ana');

      const response = await request(app.getHttpServer())
        .get('/api/users/me/consents')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(200);

      const body = response.body as {
        '@type': string;
        current: {
          terms: {
            id: string;
            type: 'terms';
            documentVersion: string;
            action: 'granted';
            source: string;
            recordedAt: string;
            fingerprint: string;
          } | null;
          privacy: {
            id: string;
            type: 'privacy';
            documentVersion: string;
            action: 'granted';
            source: string;
            recordedAt: string;
            fingerprint: string;
          } | null;
          location: unknown;
        };
        history: { id: string; type: string }[];
      };

      expect(body['@type']).toBe('UserConsents');
      expect(body.current.location).toBeNull();
      expect(body.current.terms).toMatchObject({
        type: 'terms',
        documentVersion: '1.0',
        action: 'granted',
        source: 'registration',
      });
      expect(body.current.privacy).toMatchObject({
        type: 'privacy',
        documentVersion: '1.0',
        action: 'granted',
        source: 'registration',
      });
      expect(body.current.terms?.fingerprint).toBe(
        computeConsentFingerprint({
          userId: ana.id,
          type: 'terms',
          documentVersion: '1.0',
          action: 'granted',
          recordedAt: new Date(body.current.terms!.recordedAt),
        }),
      );
      expect(body.current.privacy?.fingerprint).toBe(
        computeConsentFingerprint({
          userId: ana.id,
          type: 'privacy',
          documentVersion: '1.0',
          action: 'granted',
          recordedAt: new Date(body.current.privacy!.recordedAt),
        }),
      );
      expect(body.history).toHaveLength(2);

      const events = await dataSource.query<{ payload: { type: string } }[]>(
        `SELECT payload FROM events
          WHERE type = 'consent.granted' AND source_entity_id = $1`,
        [ana.id],
      );
      expect(new Set(events.map((e) => e.payload.type))).toEqual(
        new Set(['terms', 'privacy']),
      );
    });

    it('appends location consent transitions (granted and revoked) and keeps the full audit history', async () => {
      const ana = await createUser('ana');

      const granted = await request(app.getHttpServer())
        .put('/api/users/me/consents/location')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .send({ action: 'granted' })
        .expect(200);

      expect(granted.body).toMatchObject({
        '@type': 'UserConsents',
        current: {
          location: {
            type: 'location',
            documentVersion: '1.0',
            action: 'granted',
            source: 'settings',
          },
        },
      });
      expect((granted.body as { history: unknown[] }).history).toHaveLength(3);

      // Idempotente si se vuelve a enviar el mismo estado seguido
      const repeated = await request(app.getHttpServer())
        .put('/api/users/me/consents/location')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .send({ action: 'granted' })
        .expect(200);
      expect((repeated.body as { history: unknown[] }).history).toHaveLength(3);

      const revoked = await request(app.getHttpServer())
        .put('/api/users/me/consents/location')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .send({ action: 'revoked' })
        .expect(200);

      const revokedBody = revoked.body as {
        current: {
          location: { action: string; fingerprint: string; recordedAt: string };
        };
        history: { type: string; action: string }[];
      };
      expect(revokedBody.current.location.action).toBe('revoked');
      expect(revokedBody.current.location.fingerprint).toBe(
        computeConsentFingerprint({
          userId: ana.id,
          type: 'location',
          documentVersion: '1.0',
          action: 'revoked',
          recordedAt: new Date(revokedBody.current.location.recordedAt),
        }),
      );
      expect(revokedBody.history).toHaveLength(4);
      expect(revokedBody.history.slice(0, 2)).toEqual([
        expect.objectContaining({ type: 'location', action: 'revoked' }),
        expect.objectContaining({ type: 'location', action: 'granted' }),
      ]);

      const revokedEvents = await dataSource.query<
        { payload: { type: string } }[]
      >(
        `SELECT payload FROM events
          WHERE type = 'consent.revoked' AND source_entity_id = $1`,
        [ana.id],
      );
      expect(revokedEvents).toEqual([
        { payload: expect.objectContaining({ type: 'location' }) as unknown },
      ]);
    });

    it('migrates terms_accepted_at into user_consents with valid SHA-256 fingerprints', async () => {
      const ana = await createUser('ana');
      await dataSource.query('DELETE FROM user_consents WHERE user_id = $1', [
        ana.id,
      ]);

      await dataSource.query(
        String.raw`
          INSERT INTO user_consents (
            user_id, type, document_version, action, source, recorded_at, fingerprint
          )
          SELECT u.id,
                 c.type,
                 '1.0',
                 'granted',
                 'registration',
                 date_trunc('milliseconds', u.terms_accepted_at),
                 encode(
                   sha256(
                     convert_to(
                       u.id::text
                       || '|' || c.type::text
                       || '|1.0|granted|'
                       || to_char(
                            date_trunc('milliseconds', u.terms_accepted_at) AT TIME ZONE 'UTC',
                            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                          ),
                       'UTF8'
                     )
                   ),
                   'hex'
                 )
            FROM users u
           CROSS JOIN (
             VALUES ('terms'::consent_type), ('privacy'::consent_type)
           ) AS c(type)
           WHERE u.id = $1
        `,
        [ana.id],
      );

      const rows = await dataSource.query<
        {
          user_id: string;
          type: 'terms' | 'privacy';
          document_version: string;
          action: 'granted';
          source: string;
          recorded_at: Date;
          fingerprint: string;
        }[]
      >(
        `SELECT user_id, type, document_version, action, source, recorded_at, fingerprint
           FROM user_consents
          WHERE user_id = $1
          ORDER BY type`,
        [ana.id],
      );

      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.source).toBe('registration');
        expect(row.fingerprint).toBe(
          computeConsentFingerprint({
            userId: row.user_id,
            type: row.type,
            documentVersion: row.document_version,
            action: row.action,
            recordedAt: row.recorded_at,
          }),
        );
      }
    });

    it('rejects an invalid location consent action with 400 and requires a token', async () => {
      const ana = await createUser('ana');

      await request(app.getHttpServer())
        .put('/api/users/me/consents/location')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .send({ action: 'maybe' })
        .expect(400)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'VALIDATION_FAILED' }),
        );

      await request(app.getHttpServer())
        .get('/api/users/me/consents')
        .expect(401);
    });
  });

  // Verificación del teléfono por SMS (OTP de 6 cifras)
  describe('POST /api/users/me/phone-verification and /confirm', () => {
    it('sends a 6-digit SMS code, verifies the phone, records user.phone_verified without the phone and resets when the phone changes', async () => {
      const ana = await createUser('ana');

      await request(app.getHttpServer())
        .post('/api/users/me/phone-verification')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(202);

      const code = lastSmsCodeSentTo(app, TEST_PHONE);
      const verified = await request(app.getHttpServer())
        .post('/api/users/me/phone-verification/confirm')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .send({ code })
        .expect(200);

      expect(verified.body).toMatchObject({
        '@type': 'User',
        id: ana.id,
        phone: TEST_PHONE,
        phoneVerified: true,
      });

      const events = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events
          WHERE type = 'user.phone_verified' AND source_entity_id = $1`,
        [ana.id],
      );
      expect(events).toEqual([{ payload: {} }]);
      expect(JSON.stringify(events)).not.toContain(TEST_PHONE);

      // Cambiar el número en PATCH /api/users/me pone phoneVerified a false
      const changed = await updateMe(
        { phone: '+34611223344' },
        ana.accessToken,
      ).expect(200);
      expect(changed.body).toMatchObject({
        phone: '+34611223344',
        phoneVerified: false,
      });
    });

    it('cancels the code after 3 wrong attempts (429 TOO_MANY_ATTEMPTS)', async () => {
      const ana = await createUser('ana');
      await request(app.getHttpServer())
        .post('/api/users/me/phone-verification')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(202);
      const code = lastSmsCodeSentTo(app, TEST_PHONE);
      const wrong = code === '000000' ? '000001' : '000000';

      for (const expectedStatus of [400, 400, 429]) {
        const res = await request(app.getHttpServer())
          .post('/api/users/me/phone-verification/confirm')
          .set('Authorization', `Bearer ${ana.accessToken}`)
          .send({ code: wrong })
          .expect(expectedStatus);
        expect(res.body).toMatchObject({
          code:
            expectedStatus === 429
              ? 'TOO_MANY_ATTEMPTS'
              : 'INVALID_VERIFICATION_CODE',
        });
      }
    });

    it('rejects verifying when the user has no phone saved (409 PHONE_REQUIRED)', async () => {
      const ana = await createUser('ana');
      await dataSource.query('UPDATE users SET phone = NULL WHERE id = $1', [
        ana.id,
      ]);

      const countBefore = testSmsBox(app).sentTo(TEST_PHONE).length;
      const res = await request(app.getHttpServer())
        .post('/api/users/me/phone-verification')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(409);

      expect(res.body).toMatchObject({ code: 'PHONE_REQUIRED' });
      expect(testSmsBox(app).sentTo(TEST_PHONE)).toHaveLength(countBefore);
    });
  });

  // Eliminación (desactivación) de la cuenta con código enviado al correo
  describe('POST /api/users/me/account-deletion and /confirm', () => {
    async function insertDriverWithTrip(
      driverId: string,
      status: 'published' | 'confirmed' | 'in_progress' | 'finished',
    ): Promise<string> {
      await dataSource.query(
        `INSERT INTO driver_profiles (user_id, is_active, has_license_declared, license_declared_at)
         VALUES ($1, true, true, now())
         ON CONFLICT (user_id) DO UPDATE SET is_active = true`,
        [driverId],
      );
      const [vehicle] = await dataSource.query<{ id: string }[]>(
        `INSERT INTO vehicles (driver_id, plate, capacity)
         VALUES ($1, $2, 4)
         RETURNING id`,
        [driverId, `${driverId.slice(0, 4)}BCD`.toUpperCase()],
      );
      const [trip] = await dataSource.query<{ id: string }[]>(
        `INSERT INTO trips (
           driver_id, vehicle_id, origin, destination, origin_name, destination_name,
           departure_at, offered_seats, available_seats, max_detour_min, status
         ) VALUES (
           $1, $2,
           ST_SetSRID(ST_MakePoint(-2.4637, 36.834), 4326)::geography,
           ST_SetSRID(ST_MakePoint(-2.4046, 36.8295), 4326)::geography,
           'Almería Centro', 'Campus UAL',
           now() + interval '2 days', 3, 3, 15, $3
         ) RETURNING id`,
        [driverId, vehicle.id, status],
      );
      await dataSource.query(
        `INSERT INTO routes (trip_id, distance_km, duration_min, geometry, source)
         VALUES ($1, 8.5, 15, ST_GeogFromText('LINESTRING(-2.4637 36.834, -2.4046 36.8295)'), 'estimated')`,
        [trip.id],
      );
      return trip.id;
    }

    it('deactivates the account, cancels pending requests, revokes sessions and consents, and makes login return 401 INVALID_CREDENTIALS', async () => {
      const ana = await createUser('ana');
      const driver = await createUser('driver');
      const tripId = await insertDriverWithTrip(driver.id, 'published');

      // Ana tiene una solicitud pendiente en el viaje de driver y ha concedido
      // el permiso de ubicación
      const [pendingReq] = await dataSource.query<{ id: string }[]>(
        `INSERT INTO requests (trip_id, passenger_id, seats, is_priority, status)
         VALUES ($1, $2, 1, false, 'pending')
         RETURNING id`,
        [tripId, ana.id],
      );
      await request(app.getHttpServer())
        .put('/api/users/me/consents/location')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .send({ action: 'granted' })
        .expect(200);

      const anaEmail = `${EMAIL_PREFIX}ana@ual.es`;
      await request(app.getHttpServer())
        .post('/api/users/me/account-deletion')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .expect(202);
      const code = lastCodeSentTo(app, anaEmail);

      await request(app.getHttpServer())
        .post('/api/users/me/account-deletion/confirm')
        .set('Authorization', `Bearer ${ana.accessToken}`)
        .send({ code })
        .expect(204);

      // 1) Solicitud pendiente cancelada + evento request.cancelled + aviso al conductor
      const [reqRow] = await dataSource.query<
        { status: string; cancelled_at: Date | null }[]
      >('SELECT status, cancelled_at FROM requests WHERE id = $1', [
        pendingReq.id,
      ]);
      expect(reqRow.status).toBe('cancelled');
      expect(reqRow.cancelled_at).not.toBeNull();

      const driverNotifs = await dataSource.query<{ type: string }[]>(
        `SELECT type FROM notifications WHERE user_id = $1 AND request_id = $2`,
        [driver.id, pendingReq.id],
      );
      expect(driverNotifs).toEqual([{ type: 'request_cancelled' }]);

      // 2) Todos sus tokens de renovación quedan revocados
      const activeTokens = await dataSource.query<{ id: string }[]>(
        `SELECT id FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
        [ana.id],
      );
      expect(activeTokens).toHaveLength(0);

      // 3) Retirada de cada consentimiento concedido (terms, privacy y location) con source account_deletion
      const revokedConsents = await dataSource.query<
        { type: string; action: string; source: string }[]
      >(
        `SELECT type, action, source FROM user_consents
          WHERE user_id = $1 AND source = 'account_deletion'
          ORDER BY type`,
        [ana.id],
      );
      expect(revokedConsents).toEqual([
        { type: 'terms', action: 'revoked', source: 'account_deletion' },
        { type: 'privacy', action: 'revoked', source: 'account_deletion' },
        { type: 'location', action: 'revoked', source: 'account_deletion' },
      ]);

      // 4) Evento user.deactivated registrado
      const deactivatedEvents = await dataSource.query<{ payload: object }[]>(
        `SELECT payload FROM events WHERE type = 'user.deactivated' AND source_entity_id = $1`,
        [ana.id],
      );
      expect(deactivatedEvents).toEqual([{ payload: {} }]);

      // 5) El login de una cuenta desactivada responde 401 INVALID_CREDENTIALS
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: anaEmail, password: PASSWORD })
        .expect(401)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'INVALID_CREDENTIALS' }),
        );
    });

    it('blocks account deletion with 409 ACCOUNT_HAS_ACTIVE_TRIPS when the user has an active trip as driver or an accepted seat as passenger', async () => {
      const driver = await createUser('driver');
      const passenger = await createUser('passenger');
      const tripId = await insertDriverWithTrip(driver.id, 'confirmed');
      await dataSource.query(
        `INSERT INTO requests (trip_id, passenger_id, seats, is_priority, status, answered_at)
         VALUES ($1, $2, 1, false, 'accepted', now())`,
        [tripId, passenger.id],
      );

      // El conductor no puede eliminar su cuenta mientras el viaje no haya terminado
      const driverEmail = `${EMAIL_PREFIX}driver@ual.es`;
      await request(app.getHttpServer())
        .post('/api/users/me/account-deletion')
        .set('Authorization', `Bearer ${driver.accessToken}`)
        .expect(202);
      const driverCode = lastCodeSentTo(app, driverEmail);

      await request(app.getHttpServer())
        .post('/api/users/me/account-deletion/confirm')
        .set('Authorization', `Bearer ${driver.accessToken}`)
        .send({ code: driverCode })
        .expect(409)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'ACCOUNT_HAS_ACTIVE_TRIPS' }),
        );

      // El pasajero con plaza aceptada tampoco puede eliminar su cuenta
      const passengerEmail = `${EMAIL_PREFIX}passenger@ual.es`;
      await request(app.getHttpServer())
        .post('/api/users/me/account-deletion')
        .set('Authorization', `Bearer ${passenger.accessToken}`)
        .expect(202);
      const passengerCode = lastCodeSentTo(app, passengerEmail);

      await request(app.getHttpServer())
        .post('/api/users/me/account-deletion/confirm')
        .set('Authorization', `Bearer ${passenger.accessToken}`)
        .send({ code: passengerCode })
        .expect(409)
        .expect(({ body }) =>
          expect(body).toMatchObject({ code: 'ACCOUNT_HAS_ACTIVE_TRIPS' }),
        );

      // El código no se ha gastado: una vez finalizado el viaje, el mismo código funciona
      await dataSource.query(
        `UPDATE trips SET status = 'finished', started_at = now() WHERE id = $1`,
        [tripId],
      );
      await request(app.getHttpServer())
        .post('/api/users/me/account-deletion/confirm')
        .set('Authorization', `Bearer ${passenger.accessToken}`)
        .send({ code: passengerCode })
        .expect(204);
    });
  });
});
