import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser, TEST_PHONE } from './support/accounts';

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
      profiles: ['passenger'],
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
});
