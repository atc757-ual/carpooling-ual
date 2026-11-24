import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { withPlatformSettings } from './support/platform-settings-lock';

// Ajustes de la plataforma, de punta a punta: la app los lee y el
// administrador los cambia, con su auditoría. Los usuarios llevan el prefijo
// EMAIL_PREFIX; al acabar, el ajuste vuelve a como lo deja la migración
const EMAIL_PREFIX = 'settings-e2e-';
const PASSWORD = 'secret-password';

interface AdminSettingsBody {
  '@type': string;
  href: string;
  multiDayPublishing: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; name: string } | null;
}

describe('Platform settings (e2e)', () => {
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

  // Cada test, con los ajustes en exclusiva y dejándolos como la migración
  function itWithSettings(name: string, run: () => Promise<void>): void {
    it(name, () => withPlatformSettings(dataSource, run));
  }

  afterAll(async () => {
    await app.close();
  });

  async function login(
    name: string,
    isAdmin: boolean,
  ): Promise<{ id: string; token: string }> {
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
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      id,
      token: (response.body as { accessToken: string }).accessToken,
    };
  }

  function api(
    method: 'get' | 'patch',
    path: string,
    token: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  itWithSettings(
    'starts with multi-day publishing off, never changed',
    async () => {
      const admin = await login('ana', true);

      const read = await api('get', '/admin/settings', admin.token).expect(200);

      expect(read.body).toEqual({
        '@type': 'PlatformSettings',
        href: '/api/admin/settings',
        multiDayPublishing: false,
        updatedAt: null,
        updatedBy: null,
      });
    },
  );

  itWithSettings(
    'lets the admin turn it on, tells the app and records it once',
    async () => {
      const admin = await login('ana', true);
      const pia = await login('pia', false);

      const changed = await api('patch', '/admin/settings', admin.token)
        .send({ multiDayPublishing: true })
        .expect(200);
      const body = changed.body as AdminSettingsBody;
      expect(body.multiDayPublishing).toBe(true);
      expect(body.updatedBy).toEqual({ id: admin.id, name: 'ana Prueba' });
      expect(body.updatedAt).not.toBeNull();
      // Lo mismo otra vez no es un cambio
      await api('patch', '/admin/settings', admin.token)
        .send({ multiDayPublishing: true })
        .expect(200);

      const read = await api('get', '/settings', pia.token).expect(200);
      expect(read.body).toEqual({
        '@type': 'PlatformSettings',
        href: '/api/settings',
        multiDayPublishing: true,
      });
      const audited = await dataSource.query<{ details: object }[]>(
        `SELECT details FROM admin_actions
       WHERE admin_id = $1 AND action = 'setting.changed'`,
        [admin.id],
      );
      expect(audited.map(({ details }) => details)).toEqual([
        { setting: 'multiDayPublishing', previous: false, value: true },
      ]);
    },
  );

  itWithSettings(
    'leaves the settings that are not sent and checks their type',
    async () => {
      const admin = await login('ana', true);

      const same = await api('patch', '/admin/settings', admin.token)
        .send({})
        .expect(200);
      expect((same.body as AdminSettingsBody).updatedAt).toBeNull();
      await api('patch', '/admin/settings', admin.token)
        .send({ multiDayPublishing: 'yes' })
        .expect(400);
    },
  );

  it('is read by anyone with a session and changed only by an admin', async () => {
    const pia = await login('pia', false);

    await request(app.getHttpServer()).get('/api/settings').expect(401);
    await api('get', '/admin/settings', pia.token).expect(403);
    await api('patch', '/admin/settings', pia.token)
      .send({ multiDayPublishing: true })
      .expect(403);
  });
});
