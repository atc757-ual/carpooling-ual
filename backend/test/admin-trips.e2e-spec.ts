import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EventsService } from '../src/events/events.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Viajes del panel (solo lectura). Los usuarios llevan el prefijo
// EMAIL_PREFIX y los viajes salen en 2099, para que los filtros solo vean los
// del test. Todo se borra al terminar
const EMAIL_PREFIX = 'admin-trips-e2e-';
const PASSWORD = 'secret-password';
const DAY = '2099-03-10';

interface TripRow {
  id: string;
  status: string;
  driver: { id: string; name: string | null };
  requests: { pending: number; accepted: number };
}

describe('Admin trips API (e2e)', () => {
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

  function api(path: string, token = adminToken): request.Test {
    return request(app.getHttpServer())
      .get(`/api/admin/trips${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  // Un viaje de Dan el DAY a la hora dada (hora del campus) con una
  // solicitud aceptada y otra pendiente
  async function tripWithRequests(time: string, status: string, tag: string) {
    const dan = await account(`dan${tag}`, ['driver']);
    const pia = await account(`pia${tag}`, ['passenger']);
    const leo = await account(`leo${tag}`, ['passenger']);
    const [vehicle]: { id: string }[] = await dataSource.query(
      `INSERT INTO vehicles (driver_id, plate, capacity)
       VALUES ($1, $2, 4) RETURNING id`,
      [dan.id, `${Math.floor(1000 + Math.random() * 8999)}XYZ`],
    );
    const [trip]: { id: string }[] = await dataSource.query(
      `INSERT INTO trips (driver_id, vehicle_id, origin, destination,
                          departure_at, offered_seats, available_seats, status)
       VALUES ($1, $2, 'POINT(-2.4637 36.8381)', 'POINT(-2.4058 36.8297)',
               ($3::timestamp AT TIME ZONE 'Europe/Madrid'), 3, 2, $4)
       RETURNING id`,
      [dan.id, vehicle.id, `${DAY} ${time}`, status],
    );
    const [accepted]: { id: string }[] = await dataSource.query(
      `INSERT INTO requests (trip_id, passenger_id, status)
       VALUES ($1, $2, 'accepted') RETURNING id`,
      [trip.id, pia.id],
    );
    await dataSource.query(
      `INSERT INTO requests (trip_id, passenger_id, is_priority)
       VALUES ($1, $2, true)`,
      [trip.id, leo.id],
    );
    return { tripId: trip.id, acceptedId: accepted.id, driverId: dan.id };
  }

  it('rejects users without the admin profile (403)', async () => {
    const { token } = await account('pia', ['passenger']);

    await api('', token).expect(403);
    await api(`/${randomUUID()}`, token).expect(403);
  });

  it('lists the trips of some days, by status and by driver', async () => {
    const early = await tripWithRequests('08:00', 'confirmed', 'early');
    const late = await tripWithRequests('23:30', 'published', 'late');

    const day = await api(`?from=${DAY}&to=${DAY}`).expect(200);
    const trips = day.body as TripRow[];
    expect(trips.map(({ id }) => id)).toEqual([late.tripId, early.tripId]);
    expect(day.headers['x-total-count']).toBe('2');
    expect(trips[1]).toMatchObject({
      status: 'confirmed',
      driver: { id: early.driverId, name: 'danearly Prueba' },
      requests: { pending: 1, accepted: 1 },
    });

    const confirmed = await api(
      `?from=${DAY}&to=${DAY}&status=confirmed`,
    ).expect(200);
    expect((confirmed.body as TripRow[]).map(({ id }) => id)).toEqual([
      early.tripId,
    ]);

    const byDriver = await api(`?driver=${EMAIL_PREFIX}danlate`).expect(200);
    expect((byDriver.body as TripRow[]).map(({ id }) => id)).toEqual([
      late.tripId,
    ]);

    const nobody = await api('?driver=nadie-se-llama-asi-xyz').expect(200);
    expect(nobody.body).toEqual([]);
    expect(nobody.headers['x-total-count']).toBe('0');

    const nextDay = await api('?from=2099-03-11').expect(200);
    expect(
      (nextDay.body as TripRow[]).some(({ id }) => id === late.tripId),
    ).toBe(false);
  });

  it('shows a trip with its requests and the timeline of its events', async () => {
    const { tripId, acceptedId } = await tripWithRequests(
      '09:15',
      'confirmed',
      'detail',
    );
    const events = app.get(EventsService);
    await dataSource.transaction(async (manager) => {
      await events.record(manager, {
        type: 'trip.published',
        sourceEntityId: tripId,
        payload: { status: 'published' },
      });
      await events.record(manager, {
        type: 'request.accepted',
        sourceEntityId: acceptedId,
        payload: { status: 'accepted' },
      });
    });

    const detail = await api(`/${tripId}`).expect(200);

    expect(detail.body).toMatchObject({
      '@type': 'AdminTripDetail',
      href: `/api/admin/trips/${tripId}`,
      requests: { pending: 1, accepted: 1 },
    });
    const body = detail.body as {
      seatRequests: {
        status: string;
        isPriority: boolean;
        passenger: { name: string };
      }[];
      timeline: { type: string; payload?: unknown }[];
    };
    expect(body.seatRequests.map((seat) => seat.isPriority)).toEqual([
      true,
      false,
    ]);
    expect(body.seatRequests[1]).toMatchObject({
      status: 'accepted',
      passenger: { name: 'piadetail Prueba' },
    });
    expect(body.timeline.map(({ type }) => type)).toEqual([
      'trip.published',
      'request.accepted',
    ]);
    expect(body.timeline[0].payload).toBeUndefined();
  });

  it('validates the filters and reports a missing trip', async () => {
    await api('?from=10/03/2099').expect(400);
    await api('?status=flying').expect(400);
    await api('/not-a-uuid').expect(400);
    const missing = await api(`/${randomUUID()}`).expect(404);
    expect((missing.body as { code: string }).code).toBe('TRIP_NOT_FOUND');
  });
});
