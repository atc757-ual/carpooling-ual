import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Catálogo de opciones de las preferencias: la app las ve todas y solo se
// eligen las activas; el panel cambia textos, orden y si se ofrecen, pero no
// crea opciones. Los usuarios llevan el prefijo EMAIL_PREFIX. Las opciones
// que toca el test vuelven a su estado (y se borran sus eventos) al terminar
const EMAIL_PREFIX = 'catalog-preferences-e2e-';
const PASSWORD = 'secret-password';

interface Option {
  key: string;
  preference: string;
  value: string;
  name: string;
  nameEn: string;
  isActive: boolean;
  sortOrder?: number;
}

interface OptionRow {
  key: string;
  name: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
}

describe('Travel preference options catalog (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let userToken: string;
  let snapshot: OptionRow[];
  let startedAt: Date;

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
    startedAt = new Date();
    snapshot = await dataSource.query(
      'SELECT key, name, name_en, is_active, sort_order FROM travel_preference_options',
    );
    adminToken = await login('admin', true);
    userToken = await login('pia', false);
  });

  afterEach(async () => {
    for (const row of snapshot) {
      await dataSource.query(
        `UPDATE travel_preference_options
            SET name = $2, name_en = $3, is_active = $4, sort_order = $5
          WHERE key = $1`,
        [row.key, row.name, row.name_en, row.is_active, row.sort_order],
      );
    }
    await dataSource.query(
      `DELETE FROM events
        WHERE occurred_at >= $1
          AND source_entity_id IN (SELECT id FROM travel_preference_options)`,
      [startedAt],
    );
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(name: string, isAdmin: boolean): Promise<string> {
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
    return (response.body as { accessToken: string }).accessToken;
  }

  function admin(method: 'post' | 'patch', path: string): request.Test {
    return request(app.getHttpServer())
      [method](`/api/admin/catalogs/travel-preferences${path}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  async function options(): Promise<Option[]> {
    const response = await request(app.getHttpServer())
      .get('/api/catalogs/travel-preferences?limit=100')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    return response.body as Option[];
  }

  function choosePets(value: string): request.Test {
    return request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ preferences: { pets: value } });
  }

  it('lists every option with its Spanish and English text', async () => {
    const list = await options();

    expect(list).toHaveLength(11);
    expect(list.find(({ key }) => key === 'music-soft')).toEqual({
      '@type': 'TravelPreferenceOption',
      key: 'music-soft',
      preference: 'music',
      value: 'soft',
      name: 'Música suave',
      nameEn: 'Soft music',
      isActive: true,
    });
  });

  it('renames an option and does not let the panel create new ones', async () => {
    const renamed = await admin('patch', '/music-soft')
      .send({ name: 'Música bajita', nameEn: 'Low music' })
      .expect(200);
    expect(renamed.body).toMatchObject({
      name: 'Música bajita',
      nameEn: 'Low music',
      value: 'soft',
    });

    await admin('post', '').send({ name: 'Con karaoke' }).expect(404);
  });

  it('stops offering an option but keeps it for whoever had it', async () => {
    await choosePets('pet_friendly').expect(200);
    await admin('patch', '/pets-pet-friendly')
      .send({ isActive: false })
      .expect(200);

    const offered = (await options()).find(
      ({ key }) => key === 'pets-pet-friendly',
    );
    expect(offered?.isActive).toBe(false);
    await choosePets('none').expect(200);
    const rejected = await choosePets('pet_friendly').expect(400);
    expect((rejected.body as { code: string }).code).toBe(
      'TRAVEL_PREFERENCE_NOT_OFFERED',
    );
  });

  it('orders the options only within their preference', async () => {
    const musicValues = async () =>
      (await options())
        .filter(({ preference }) => preference === 'music')
        .map(({ value }) => value);

    // La primera de Música no sube por encima de las de Conversación
    await admin('post', '/music-any/move')
      .send({ direction: 'up' })
      .expect(200);
    expect(await musicValues()).toEqual(['any', 'soft', 'none']);

    await admin('post', '/music-none/move')
      .send({ direction: 'up' })
      .expect(200);
    expect(await musicValues()).toEqual(['any', 'none', 'soft']);
  });
});
