import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Catálogo de colores: la app los ve todos (para nombrar el de cada
// vehículo) y solo se eligen los activos. Los usuarios llevan el prefijo
// EMAIL_PREFIX; los colores del test, nombres que empiezan por «E2E Color»
// (clave e2e-color-…). Se borran al terminar con sus vehículos y eventos
const EMAIL_PREFIX = 'catalog-colors-e2e-';
const PASSWORD = 'secret-password';
const COLOR_KEYS = "key LIKE 'e2e-color-%'";

interface Color {
  key: string;
  name: string;
  hexLight: string;
  hexDark: string;
  isActive: boolean;
}

describe('Vehicle colors catalog (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let driverToken: string;

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
    adminToken = await login('admin', ['passenger'], true);
    driverToken = await login('dan', ['driver'], false);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (
         SELECT id FROM vehicle_colors WHERE ${COLOR_KEYS})`,
    );
    await dataSource.query(`DELETE FROM vehicle_colors WHERE ${COLOR_KEYS}`);
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(
    name: string,
    profiles: string[],
    isAdmin: boolean,
  ): Promise<string> {
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
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  }

  function admin(method: 'post' | 'patch', path = ''): request.Test {
    return request(app.getHttpServer())
      [method](`/api/admin/catalogs/vehicle-colors${path}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  async function colors(): Promise<Color[]> {
    const response = await request(app.getHttpServer())
      .get('/api/catalogs/vehicle-colors?limit=100')
      .set('Authorization', `Bearer ${driverToken}`)
      .expect(200);
    return response.body as Color[];
  }

  function registerVehicle(color: string, plate: string): request.Test {
    return request(app.getHttpServer())
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        plate,
        capacity: 3,
        brand: 'SEAT',
        model: 'Ibiza',
        color,
        engine: 'hybrid',
        declarationVersion: '1.0',
      });
  }

  it('lists the colors with their light and dark swatches', async () => {
    const list = await colors();

    expect(list.slice(0, 2)).toEqual([
      {
        '@type': 'VehicleColor',
        key: 'white',
        name: 'Blanco',
        hexLight: '#ffffff',
        hexDark: '#e8eaed',
        isActive: true,
      },
      expect.objectContaining({ key: 'black', name: 'Negro' }),
    ]);
  });

  it('adds a color that drivers can choose, and keeps it named once deactivated', async () => {
    await admin('post')
      .send({ name: 'E2E Color Oro', hexLight: '#c9a227', hexDark: '#e0c060' })
      .expect(201);
    const vehicle = await registerVehicle('e2e-color-oro', '4321ZZX').expect(
      201,
    );
    expect((vehicle.body as { color: string }).color).toBe('e2e-color-oro');

    await admin('patch', '/e2e-color-oro')
      .send({ isActive: false, hexDark: '#d4b04a' })
      .expect(200);
    const gold = (await colors()).find(({ key }) => key === 'e2e-color-oro');
    expect(gold).toMatchObject({ isActive: false, hexDark: '#d4b04a' });

    const rejected = await registerVehicle('e2e-color-oro', '4322ZZX').expect(
      400,
    );
    expect((rejected.body as { code: string }).code).toBe(
      'VEHICLE_COLOR_NOT_OFFERED',
    );
  });

  it('rejects an unknown color and invalid swatches', async () => {
    const unknown = await registerVehicle('gold', '4323ZZX').expect(400);
    expect((unknown.body as { code: string }).code).toBe(
      'VEHICLE_COLOR_NOT_OFFERED',
    );
    await admin('post')
      .send({ name: 'E2E Color Mal', hexLight: 'red', hexDark: '#000000' })
      .expect(400);
    await admin('patch', '/white').send({ hexDark: '#12345' }).expect(400);
  });
});
