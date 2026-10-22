import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';

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
    const registered = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name, email, password: PASSWORD, profiles: ['passenger'] })
      .expect(201);
    const { id } = registered.body as { id: string };
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

    expect(response.body).toMatchObject({ id: bob.id, name: 'bob' });
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
});
