import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Usuarios en el panel de administración (RF-25, CU-13) de punta a punta. Los
// usuarios llevan el prefijo EMAIL_PREFIX y se borran con todo lo suyo
const EMAIL_PREFIX = 'admin-users-e2e-';
const PASSWORD = 'secret-password';
const REASON = 'Checked with the user by phone';

interface Row {
  id: string;
  name: string;
  statuses: string[];
  tripCount: number;
  openIncidents: number;
  suspensions: { driver: string | null; passenger: string | null } | null;
}

describe('Admin users API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;

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
    ({ token: adminToken } = await account('admin', ['passenger'], true));
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
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

  function api(
    method: 'get' | 'post' | 'put',
    path: string,
    token = adminToken,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function list(query = ''): Promise<Row[]> {
    const response = await api(
      'get',
      `/admin/users?search=${EMAIL_PREFIX}${query}`,
    ).expect(200);
    return response.body as Row[];
  }

  async function rowOf(userId: string): Promise<Row | undefined> {
    return (await list()).find(({ id }) => id === userId);
  }

  // Un viaje del conductor creado con SQL (sin pasar por publicar)
  async function insertTrip(driverId: string, status: string): Promise<string> {
    const [vehicle]: { id: string }[] = await dataSource.query(
      `INSERT INTO vehicles (driver_id, plate, capacity)
       VALUES ($1, $2, 4) RETURNING id`,
      [driverId, `${Math.floor(1000 + Math.random() * 8999)}XYZ`],
    );
    const [trip]: { id: string }[] = await dataSource.query(
      `INSERT INTO trips (driver_id, vehicle_id, origin, destination,
                          departure_at, offered_seats, available_seats, status)
       VALUES ($1, $2, 'POINT(-2.4637 36.8381)', 'POINT(-2.4058 36.8297)',
               now(), 3, 3, $3) RETURNING id`,
      [driverId, vehicle.id, status],
    );
    return trip.id;
  }

  it('rejects users without the admin profile (403)', async () => {
    const { id, token } = await account('pia', ['passenger']);

    await api('get', '/admin/users', token).expect(403);
    await api('get', `/admin/users/${id}`, token).expect(403);
    await api('post', `/admin/users/${id}/suspensions/driver/lift`, token)
      .send({ reason: REASON })
      .expect(403);
  });

  it('shows everything an admin sees of a user', async () => {
    const dan = await account('dan', ['driver', 'passenger']);
    const pia = await account('pia', ['driver']);
    const ownTrip = await insertTrip(dan.id, 'cancelled');
    const otherTrip = await insertTrip(pia.id, 'published');
    await dataSource.query(
      `INSERT INTO requests (trip_id, passenger_id, status)
       VALUES ($1, $2, 'accepted')`,
      [otherTrip, dan.id],
    );
    await dataSource.query(
      `INSERT INTO incidents (trip_id, reporter_id, category, description)
       VALUES ($1, $2, 'technical', 'The car broke down on the way')`,
      [ownTrip, dan.id],
    );
    await dataSource.query(
      `INSERT INTO late_cancellations (user_id, trip_id, role)
       VALUES ($1, $2, 'driver')`,
      [dan.id, ownTrip],
    );

    const response = await api('get', `/admin/users/${dan.id}`).expect(200);
    const detail = response.body as {
      '@type': string;
      statuses: string[];
      vehicles: unknown[];
      trips: { id: string }[];
      requests: { status: string; trip: { id: string } | null }[];
      incidents: { role: string }[];
      lateCancellations: {
        tripId: string;
        role: string;
        waivedAt: string | null;
      }[];
      consents: { current: object } | null;
      ratings: { driver: object | null };
    };

    expect(detail['@type']).toBe('AdminUserDetail');
    expect(detail.statuses).toEqual(['open_incidents']);
    expect(detail.vehicles).toHaveLength(1);
    expect(detail.trips.map(({ id }) => id)).toEqual([ownTrip]);
    expect(detail.requests).toHaveLength(1);
    expect(detail.requests[0].status).toBe('accepted');
    expect(detail.requests[0].trip?.id).toBe(otherTrip);
    expect(detail.incidents.map(({ role }) => role)).toEqual(['reporter']);
    expect(detail.lateCancellations).toHaveLength(1);
    expect(detail.lateCancellations[0]).toMatchObject({
      tripId: ownTrip,
      role: 'driver',
      waivedAt: null,
    });
    expect(detail.consents?.current).toEqual(expect.any(Object));
    expect(detail.ratings.driver).not.toBeNull();
    expect(JSON.stringify(detail)).not.toContain('password');

    const unknown = '0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90';
    const missing = await api('get', `/admin/users/${unknown}`).expect(404);
    expect((missing.body as { code: string }).code).toBe('USER_NOT_FOUND');
  });

  it('lists the users with their trips and filters by profile', async () => {
    const dan = await account('dan', ['driver']);
    const pia = await account('pia', ['passenger']);
    await insertTrip(dan.id, 'published');
    await insertTrip(dan.id, 'cancelled');

    expect(await rowOf(dan.id)).toMatchObject({
      statuses: ['active'],
      tripCount: 1,
    });
    const drivers = await list('&profile=driver');
    expect(drivers.map(({ id }) => id)).toEqual([dan.id]);
    expect((await list('&profile=passenger')).map(({ id }) => id)).toContain(
      pia.id,
    );
  });

  it('asks for a reason to change a profile and audits it', async () => {
    const pia = await account('pia', ['passenger']);

    await api('put', `/users/${pia.id}/profiles/passenger`)
      .send({ isActive: false })
      .expect(400);
    await api('put', `/users/${pia.id}/profiles/passenger`)
      .send({ isActive: false, reason: REASON })
      .expect(200);

    expect((await rowOf(pia.id))?.statuses).toEqual(['profile_deactivated']);
    expect(
      (await list('&status=profile_deactivated')).map(({ id }) => id),
    ).toEqual([pia.id]);
    const audit: { action: string; reason: string; details: object }[] =
      await dataSource.query(
        'SELECT action, reason, details FROM admin_actions WHERE target_user_id = $1',
        [pia.id],
      );
    expect(audit).toEqual([
      {
        action: 'profile.deactivated',
        reason: REASON,
        details: { profile: 'passenger' },
      },
    ]);
  });

  it('shows deleted accounts and open incidents of the reporter and the driver', async () => {
    const dan = await account('dan', ['driver']);
    const pia = await account('pia', ['passenger']);
    const gone = await account('gone', ['passenger']);
    await dataSource.query(
      'UPDATE users SET deactivated_at = now() WHERE id = $1',
      [gone.id],
    );
    const tripId = await insertTrip(dan.id, 'cancelled');
    await dataSource.query(
      `INSERT INTO incidents (trip_id, reporter_id, category, description)
       VALUES ($1, $2, 'driver', 'The driver did not stop at the pickup point')`,
      [tripId, pia.id],
    );

    expect(await rowOf(pia.id)).toMatchObject({
      statuses: ['open_incidents'],
      openIncidents: 1,
    });
    expect(await rowOf(dan.id)).toMatchObject({ openIncidents: 1 });
    expect((await rowOf(gone.id))?.statuses).toEqual(['deleted']);
    const withIncidents = await list('&status=open_incidents');
    expect(withIncidents.map(({ id }) => id).sort()).toEqual(
      [dan.id, pia.id].sort(),
    );
  });

  it('lifts a suspension with a reason, with its event and audit', async () => {
    const dan = await account('dan', ['driver']);
    const tripId = await insertTrip(dan.id, 'cancelled');
    await dataSource.query(
      `INSERT INTO late_cancellations (user_id, trip_id, role)
       SELECT $1, $2, 'driver' FROM generate_series(1, 3)`,
      [dan.id, tripId],
    );

    const suspended = await rowOf(dan.id);
    expect(suspended?.statuses).toEqual(['suspended']);
    expect(suspended?.suspensions?.driver).toEqual(expect.any(String));
    expect((await list('&status=suspended')).map(({ id }) => id)).toEqual([
      dan.id,
    ]);

    const lift = (role: string, reason = REASON): request.Test =>
      api('post', `/admin/users/${dan.id}/suspensions/${role}/lift`).send({
        reason,
      });
    await lift('driver', 'short').expect(400);
    const notSuspended = await lift('passenger').expect(409);
    expect((notSuspended.body as { code: string }).code).toBe(
      'USER_NOT_SUSPENDED',
    );
    await lift('driver').expect(204);

    expect(await rowOf(dan.id)).toMatchObject({
      statuses: ['active'],
      suspensions: null,
    });
    const [event]: { payload: { role: string; waived: number } }[] =
      await dataSource.query(
        `SELECT payload FROM events
        WHERE type = 'late_cancellation.waived' AND source_entity_id = $1`,
        [dan.id],
      );
    expect(event.payload).toMatchObject({ role: 'driver', waived: 3 });
    const [audit]: { action: string; reason: string }[] =
      await dataSource.query(
        'SELECT action, reason FROM admin_actions WHERE target_user_id = $1',
        [dan.id],
      );
    expect(audit).toEqual({ action: 'suspension.lifted', reason: REASON });
  });

  it('answers 404 for an unknown user and 400 for a wrong role', async () => {
    const unknown = '0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90';
    const missing = await api(
      'post',
      `/admin/users/${unknown}/suspensions/driver/lift`,
    )
      .send({ reason: REASON })
      .expect(404);
    const badRole = await api(
      'post',
      `/admin/users/${unknown}/suspensions/pilot/lift`,
    )
      .send({ reason: REASON })
      .expect(400);
    const badStatus = await api('get', `/admin/users?status=sleeping`).expect(
      400,
    );

    expect((missing.body as { code: string }).code).toBe('USER_NOT_FOUND');
    expect((badRole.body as { code: string }).code).toBe('VALIDATION_FAILED');
    expect((badStatus.body as { code: string }).code).toBe('VALIDATION_FAILED');
  });
});
