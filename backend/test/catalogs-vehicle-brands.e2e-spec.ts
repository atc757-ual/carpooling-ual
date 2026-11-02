import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Catálogo de marcas: la lista pública y su gestión desde el panel. Los
// usuarios llevan el prefijo EMAIL_PREFIX; las marcas del test, nombres que
// empiezan por «E2E Brand» (clave e2e-brand-…). Solo se tocan las del test, y
// se borran al terminar con sus eventos
const EMAIL_PREFIX = 'catalog-brands-e2e-';
const PASSWORD = 'secret-password';
const BRAND_KEYS = "key LIKE 'e2e-brand-%'";

interface Brand {
  key: string;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
}

describe('Vehicle brands catalog (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let userToken: string;

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
    adminToken = await login('admin', true);
    userToken = await login('pia', false);
  });

  afterEach(async () => {
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (
         SELECT id FROM vehicle_brands WHERE ${BRAND_KEYS})`,
    );
    await dataSource.query(`DELETE FROM vehicle_brands WHERE ${BRAND_KEYS}`);
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

  function admin(method: 'get' | 'post' | 'patch', path = ''): request.Test {
    return request(app.getHttpServer())
      [method](`/api/admin/catalogs/vehicle-brands${path}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  function publicList(): request.Test {
    return request(app.getHttpServer())
      .get('/api/catalogs/vehicle-brands?limit=100')
      .set('Authorization', `Bearer ${userToken}`);
  }

  async function eventsOf(key: string): Promise<string[]> {
    const rows: { type: string }[] = await dataSource.query(
      `SELECT type FROM events WHERE source_entity_id =
         (SELECT id FROM vehicle_brands WHERE key = $1) ORDER BY sequence`,
      [key],
    );
    return rows.map(({ type }) => type);
  }

  it('lists the active brands to any user, in order', async () => {
    const response = await publicList().expect(200);
    const brands = response.body as Brand[];

    expect(brands.length).toBeGreaterThan(50);
    expect(brands[0]).toEqual({
      '@type': 'VehicleBrand',
      key: 'abarth',
      name: 'Abarth',
    });
    expect(brands.find(({ key }) => key === 'lynk-co')?.name).toBe('Lynk & Co');
    expect(brands.find(({ key }) => key === 'skoda')?.name).toBe('Škoda');
  });

  it('lets only admins manage the catalog (403)', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/catalogs/vehicle-brands')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/admin/catalogs/vehicle-brands')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'E2E Brand Nope' })
      .expect(403);
  });

  it('adds a brand at the end and rejects the same name again', async () => {
    const created = await admin('post')
      .send({ name: '  E2E Brand Ñandú  ' })
      .expect(201);
    expect(created.body).toMatchObject({
      key: 'e2e-brand-nandu',
      name: 'E2E Brand Ñandú',
      isActive: true,
    });
    const all = await admin('get', '?limit=100&offset=60').expect(200);
    const last = (all.body as Brand[]).at(-1);
    expect(last?.key).toBe('e2e-brand-nandu');

    const repeated = await admin('post')
      .send({ name: 'e2e brand nandu' })
      .expect(409);
    expect((repeated.body as { code: string }).code).toBe(
      'CATALOG_ITEM_EXISTS',
    );
    expect(await eventsOf('e2e-brand-nandu')).toEqual(['catalog.item_created']);
  });

  it('renames, deactivates and reactivates a brand', async () => {
    await admin('post').send({ name: 'E2E Brand Uno' }).expect(201);

    const renamed = await admin('patch', '/e2e-brand-uno')
      .send({ name: 'E2E Brand Uno Bis' })
      .expect(200);
    expect(renamed.body).toMatchObject({
      key: 'e2e-brand-uno',
      name: 'E2E Brand Uno Bis',
    });

    await admin('patch', '/e2e-brand-uno')
      .send({ isActive: false })
      .expect(200);
    const offered = (await publicList().expect(200)).body as Brand[];
    expect(offered.some(({ key }) => key === 'e2e-brand-uno')).toBe(false);

    await admin('patch', '/e2e-brand-uno').send({ isActive: true }).expect(200);
    expect(await eventsOf('e2e-brand-uno')).toEqual([
      'catalog.item_created',
      'catalog.item_updated',
      'catalog.item_deactivated',
      'catalog.item_updated',
    ]);
  });

  it('moves a brand one place and does nothing at the end', async () => {
    const first = await admin('post').send({ name: 'E2E Brand A' }).expect(201);
    const second = await admin('post')
      .send({ name: 'E2E Brand B' })
      .expect(201);
    const [orderA, orderB] = [first, second].map(
      (response) => (response.body as Brand).sortOrder,
    );

    const moved = await admin('post', '/e2e-brand-b/move')
      .send({ direction: 'up' })
      .expect(200);
    expect((moved.body as Brand).sortOrder).toBe(orderA);

    const last = await admin('post', '/e2e-brand-a/move')
      .send({ direction: 'down' })
      .expect(200);
    expect((last.body as Brand).sortOrder).toBe(orderB);
    expect(await eventsOf('e2e-brand-a')).toEqual([
      'catalog.item_created',
      'catalog.item_updated',
    ]);
  });

  it('validates the input and reports a missing brand', async () => {
    await admin('post').send({ name: '  ' }).expect(400);
    await admin('post').send({ name: '***' }).expect(400);
    await admin('post', '/abarth/move').send({ direction: 'left' }).expect(400);
    const missing = await admin('patch', '/no-such-brand')
      .send({ isActive: false })
      .expect(404);
    expect((missing.body as { code: string }).code).toBe(
      'CATALOG_ITEM_NOT_FOUND',
    );
  });
});
