import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser, TEST_PHONE } from './support/accounts';

// Gestión de usuarios por el administrador (RF-25, CU-13) de punta a punta.
// Los usuarios llevan el prefijo EMAIL_PREFIX y se borran con todo lo suyo
const EMAIL_PREFIX = 'user-admin-e2e-';
const PASSWORD = 'secret-password';

interface Session {
  id: string;
  accessToken: string;
  refreshToken: string;
}

describe('User administration API (e2e)', () => {
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

  function api(
    method: 'get' | 'put' | 'post',
    path: string,
    token: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function login(email: string): Promise<Session> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    };
    return {
      id: body.user.id,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }

  // Registra un usuario y, si isAdmin, le da el perfil de administrador en la
  // base de datos (el registro público no permite pedirlo) antes del login
  async function sessionFor(
    name: string,
    profiles: string[] = ['passenger'],
    isAdmin = false,
  ): Promise<Session> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    const id = await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles,
    });
    if (isAdmin) {
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [id],
      );
    }
    return login(email);
  }

  function setProfile(
    admin: Session,
    userId: string,
    profile: string,
    isActive: unknown,
  ): request.Test {
    return api(
      'put',
      `/users/${userId}/profiles/${profile}`,
      admin.accessToken,
    ).send({ isActive });
  }

  it('lets only administrators list users, with all their profiles', async () => {
    const ada = await sessionFor('ada', ['passenger'], true);
    const pia = await sessionFor('pia', ['passenger', 'driver']);

    const response = await api(
      'get',
      `/users?search=${EMAIL_PREFIX}pia`,
      ada.accessToken,
    ).expect(200);
    const forbidden = await api('get', '/users', pia.accessToken).expect(403);

    expect(response.headers['x-total-count']).toBe('1');
    expect(response.body).toEqual([
      {
        '@type': 'UserAdmin',
        id: pia.id,
        href: `/api/users/${pia.id}`,
        name: 'pia',
        email: `${EMAIL_PREFIX}pia@ual.es`,
        phone: TEST_PHONE,
        profiles: [
          { profile: 'driver', isActive: true },
          { profile: 'passenger', isActive: true },
        ],
        createdAt: expect.any(String) as string,
      },
    ]);
    expect(forbidden.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
  });

  it('shows UserAdmin to an administrator and User to the user', async () => {
    const ada = await sessionFor('ada', ['passenger'], true);
    const pia = await sessionFor('pia');

    const asAdmin = await api(
      'get',
      `/users/${pia.id}`,
      ada.accessToken,
    ).expect(200);
    const asHerself = await api(
      'get',
      `/users/${pia.id}`,
      pia.accessToken,
    ).expect(200);

    expect(asAdmin.body).toMatchObject({ '@type': 'UserAdmin' });
    expect(asHerself.body).toMatchObject({
      '@type': 'User',
      profiles: ['passenger'],
    });
  });

  it('assigns the administrator profile: after logging in again she is an admin', async () => {
    const ada = await sessionFor('ada', ['passenger'], true);
    const pia = await sessionFor('pia');

    const response = await setProfile(ada, pia.id, 'admin', true).expect(200);

    expect(response.body).toMatchObject({
      profiles: [
        { profile: 'passenger', isActive: true },
        { profile: 'admin', isActive: true },
      ],
    });
    const piaAgain = await login(`${EMAIL_PREFIX}pia@ual.es`);
    await api('get', '/users', piaAgain.accessToken).expect(200);
  });

  it('deactivating a profile closes the sessions of the user', async () => {
    const ada = await sessionFor('ada', ['passenger'], true);
    const pia = await sessionFor('pia', ['passenger', 'driver']);

    await setProfile(ada, pia.id, 'driver', false).expect(200);

    const refresh = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: pia.refreshToken })
      .expect(401);
    expect(refresh.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('protects the administrators: not yourself (409)', async () => {
    const ada = await sessionFor('ada', ['passenger'], true);

    const response = await setProfile(ada, ada.id, 'admin', false).expect(409);

    expect(response.body).toMatchObject({ code: 'CANNOT_CHANGE_OWN_ADMIN' });
  });

  it('validates the profile, the body and that the profile exists', async () => {
    const ada = await sessionFor('ada', ['passenger'], true);
    const pia = await sessionFor('pia');

    const badProfile = await setProfile(ada, pia.id, 'pilot', true).expect(400);
    const badBody = await setProfile(ada, pia.id, 'driver', 'yes').expect(400);
    const missing = await setProfile(ada, pia.id, 'driver', true).expect(404);

    expect(badProfile.body).toMatchObject({ fields: [{ field: 'profile' }] });
    expect(badBody.body).toMatchObject({ fields: [{ field: 'isActive' }] });
    expect(missing.body).toMatchObject({ code: 'PROFILE_NOT_FOUND' });
  });
});
