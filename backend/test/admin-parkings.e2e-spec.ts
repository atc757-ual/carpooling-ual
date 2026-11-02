import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Parkings del campus en el panel. Los usuarios llevan el prefijo
// EMAIL_PREFIX; los parkings del test, nombres que empiezan por «E2E
// Parking». Al terminar se borran (con sus eventos) y los demás vuelven a su
// orden
const EMAIL_PREFIX = 'admin-parkings-e2e-';
const PASSWORD = 'secret-password';
const TEST_PARKINGS = "name LIKE 'E2E Parking%'";
// Cerca del campus, dentro de la zona de servicio y lejos de los destinos de
// los viajes de otros tests (que corren a la vez), y en Madrid
const ON_CAMPUS = { type: 'Point', coordinates: [-2.415, 36.84] };
const MADRID = { type: 'Point', coordinates: [-3.7038, 40.4168] };

interface Parking {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  location: { coordinates: [number, number] };
}

describe('Admin campus parkings (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  let sortOrders: { id: string; sort_order: number }[];

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
    sortOrders = await dataSource.query(
      'SELECT id, sort_order FROM campus_parkings',
    );
    ({ token: adminToken } = await account('admin', ['passenger'], true));
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (
         SELECT entity_id FROM campus_parkings WHERE ${TEST_PARKINGS})`,
    );
    await dataSource.query(
      `DELETE FROM campus_parkings WHERE ${TEST_PARKINGS}`,
    );
    for (const { id, sort_order } of sortOrders) {
      await dataSource.query(
        'UPDATE campus_parkings SET sort_order = $2 WHERE id = $1',
        [id, sort_order],
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function account(
    name: string,
    profiles: string[],
    isAdmin = false,
  ): Promise<{ id: string; token: string }> {
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
    return {
      id,
      token: (response.body as { accessToken: string }).accessToken,
    };
  }

  function admin(
    method: 'get' | 'post' | 'patch',
    path = '',
    token = adminToken,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api/admin/catalogs/campus-parkings${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function createParking(name: string): Promise<Parking> {
    const response = await admin('post')
      .send({ name, location: ON_CAMPUS })
      .expect(201);
    return response.body as Parking;
  }

  // Un viaje confirmado que termina en el parking del test
  async function tripTo(status: string): Promise<string> {
    const dan = await account('dan', ['driver']);
    const [vehicle]: { id: string }[] = await dataSource.query(
      `INSERT INTO vehicles (driver_id, plate, capacity, color)
       VALUES ($1, $2, 4, 'blue') RETURNING id`,
      [dan.id, `${Math.floor(1000 + Math.random() * 8999)}XYZ`],
    );
    const [trip]: { id: string }[] = await dataSource.query(
      `INSERT INTO trips (driver_id, vehicle_id, origin, destination,
                          departure_at, offered_seats, available_seats, status)
       VALUES ($1, $2, 'POINT(-2.4637 36.8381)', 'POINT(-2.41501 36.84002)',
               now() + interval '1 day', 3, 3, $3) RETURNING id`,
      [dan.id, vehicle.id, status],
    );
    return trip.id;
  }

  it('adds a parking with the next id at the end of the list', async () => {
    const parking = await createParking('E2E Parking Norte');

    expect(parking.id).toMatch(/^p\d+$/);
    expect(parking).toMatchObject({
      name: 'E2E Parking Norte',
      isActive: true,
      location: { coordinates: ON_CAMPUS.coordinates },
    });
    const all = (await admin('get', '?limit=100').expect(200))
      .body as Parking[];
    expect(all.at(-1)?.id).toBe(parking.id);
    const offered = await request(app.getHttpServer())
      .get('/api/campus-parkings?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(
      (offered.body as Parking[]).some(({ id }) => id === parking.id),
    ).toBe(true);
  });

  it('rejects a parking outside the service area', async () => {
    const response = await admin('post')
      .send({ name: 'E2E Parking Madrid', location: MADRID })
      .expect(400);
    expect((response.body as { code: string }).code).toBe(
      'PARKING_OUTSIDE_SERVICE_AREA',
    );
  });

  it('does not close or move a parking with active trips, but renames it', async () => {
    const parking = await createParking('E2E Parking Sur');
    const tripId = await tripTo('confirmed');

    const closing = await admin('patch', `/${parking.id}`)
      .send({ isActive: false })
      .expect(409);
    expect((closing.body as { code: string }).code).toBe('PARKING_IN_USE');
    await admin('patch', `/${parking.id}`)
      .send({ location: { type: 'Point', coordinates: [-2.416, 36.841] } })
      .expect(409);
    await admin('patch', `/${parking.id}`)
      .send({ name: 'E2E Parking Sur bis' })
      .expect(200);

    await dataSource.query(
      "UPDATE trips SET status = 'cancelled' WHERE id = $1",
      [tripId],
    );
    const closed = await admin('patch', `/${parking.id}`)
      .send({ isActive: false })
      .expect(200);
    expect(closed.body).toMatchObject({
      name: 'E2E Parking Sur bis',
      isActive: false,
    });
  });

  it('orders the parkings and leaves the last one in place', async () => {
    const first = await createParking('E2E Parking A');
    const second = await createParking('E2E Parking B');

    const moved = await admin('post', `/${second.id}/move`)
      .send({ direction: 'up' })
      .expect(200);
    expect((moved.body as Parking).sortOrder).toBe(first.sortOrder);
    const last = await admin('post', `/${first.id}/move`)
      .send({ direction: 'down' })
      .expect(200);
    expect((last.body as Parking).sortOrder).toBe(second.sortOrder);
  });

  it('lets only admins manage them and reports a missing one', async () => {
    const { token } = await account('pia', ['passenger']);
    await admin('get', '', token).expect(403);
    await admin('post', '', token)
      .send({ name: 'E2E Parking Nope', location: ON_CAMPUS })
      .expect(403);

    const missing = await admin('patch', '/p999')
      .send({ name: 'E2E Parking X' })
      .expect(404);
    expect((missing.body as { code: string }).code).toBe(
      'CAMPUS_PARKING_NOT_FOUND',
    );
    await admin('post').send({ name: '***', location: ON_CAMPUS }).expect(400);
  });
});
