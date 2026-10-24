import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Viajes (RF-04, RF-05) de punta a punta. Los usuarios llevan el prefijo
// EMAIL_PREFIX; sus viajes y eventos se borran antes que ellos
const EMAIL_PREFIX = 'trips-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Trips API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let plateNumber = 9500;

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
    method: 'get' | 'post' | 'put' | 'patch',
    path: string,
    token: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  // Registra un usuario y devuelve su token de acceso
  async function tokenFor(name: string, profiles: string[]): Promise<string> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles,
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }

  // Conductor listo (RF-21) por la API: declaración y un vehículo de 4 plazas
  async function readyDriver(
    name: string,
  ): Promise<{ token: string; vehicleId: string }> {
    const token = await tokenFor(name, ['driver']);
    await api('put', '/users/me/driver-declaration', token).expect(200);
    plateNumber += 1;
    const vehicle = await api('post', '/vehicles', token)
      .send({ plate: `${plateNumber}BCD`, capacity: 4 })
      .expect(201);
    return { token, vehicleId: (vehicle.body as { id: string }).id };
  }

  function tripBody(vehicleId: string, overrides: object = {}): object {
    return {
      vehicleId,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      offeredSeats: 3,
      ...overrides,
    };
  }

  async function publishTrip(
    token: string,
    vehicleId: string,
  ): Promise<{ id: string; href: string }> {
    const response = await api('post', '/trips', token)
      .send(tripBody(vehicleId))
      .expect(201);
    return response.body as { id: string; href: string };
  }

  describe('POST /api/trips (RF-04)', () => {
    it('publishes a trip: 201, Location, GeoJSON and the driver name (no plate)', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const body = tripBody(vehicleId) as { departureAt: string };

      const response = await api('post', '/trips', token)
        .send(body)
        .expect(201);

      const trip = response.body as { id: string; driver: { id: string } };
      expect(response.body).toEqual({
        '@type': 'Trip',
        id: trip.id,
        href: `/api/trips/${trip.id}`,
        driver: { id: trip.driver.id, name: 'ana' },
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: body.departureAt,
        offeredSeats: 3,
        availableSeats: 3,
        maxDetourMin: 10,
        status: 'published',
        startedAt: null,
      });
      expect(response.headers.location).toBe(`/api/trips/${trip.id}`);
      expect(JSON.stringify(response.body)).not.toContain('BCD');
    });

    it('requires a ready driver (403 DRIVER_NOT_READY)', async () => {
      const token = await tokenFor('bob', ['driver']);

      const response = await api('post', '/trips', token)
        .send(tripBody(UNKNOWN_ID))
        .expect(403);

      expect(response.body).toMatchObject({ code: 'DRIVER_NOT_READY' });
    });

    it('validates GeoJSON points, the date and the seats', async () => {
      const { token, vehicleId } = await readyDriver('ana');

      const response = await api('post', '/trips', token)
        .send({
          ...tripBody(vehicleId),
          origin: { type: 'Point', coordinates: [-2.4, 136.8] },
          destination: { type: 'Polygon', coordinates: [-2.4, 36.8] },
          departureAt: 'tomorrow',
          offeredSeats: 0,
        })
        .expect(400);

      const { fields } = response.body as { fields: { field: string }[] };
      expect(new Set(fields.map(({ field }) => field))).toEqual(
        new Set([
          'origin.coordinates',
          'destination.type',
          'departureAt',
          'offeredSeats',
        ]),
      );
    });

    it('is only for drivers (403 PROFILE_REQUIRED for a passenger)', async () => {
      const passenger = await tokenFor('pia', ['passenger']);

      const response = await api('post', '/trips', passenger)
        .send(tripBody(UNKNOWN_ID))
        .expect(403);

      expect(response.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
    });
  });

  describe('GET /api/trips/{id} and /api/users/me/trips', () => {
    it('lets any authenticated user see a trip (its href works)', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const passenger = await tokenFor('pia', ['passenger']);
      const trip = await publishTrip(token, vehicleId);

      const response = await api(
        'get',
        trip.href.replace('/api', ''),
        passenger,
      ).expect(200);

      expect(response.body).toMatchObject({ id: trip.id, status: 'published' });
    });

    it('answers 404 TRIP_NOT_FOUND for an unknown trip', async () => {
      const passenger = await tokenFor('pia', ['passenger']);

      const response = await api(
        'get',
        `/trips/${UNKNOWN_ID}`,
        passenger,
      ).expect(404);

      expect(response.body).toMatchObject({ code: 'TRIP_NOT_FOUND' });
    });

    it('lists my trips with the TMF pagination headers', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      await publishTrip(token, vehicleId);
      await publishTrip(token, vehicleId);

      const response = await api(
        'get',
        '/users/me/trips?limit=1',
        token,
      ).expect(200);

      expect(response.headers['x-total-count']).toBe('2');
      expect(response.headers['x-result-count']).toBe('1');
      expect(response.body).toMatchObject([{ '@type': 'Trip' }]);
    });
  });

  describe('PATCH /api/trips/{id} and cancel (RF-05)', () => {
    it('changes only the fields sent', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const trip = await publishTrip(token, vehicleId);

      const response = await api('patch', `/trips/${trip.id}`, token)
        .send({ offeredSeats: 2 })
        .expect(200);

      expect(response.body).toMatchObject({
        offeredSeats: 2,
        availableSeats: 2,
        destination: UAL_CAMPUS,
      });
    });

    it('rejects an empty change', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const trip = await publishTrip(token, vehicleId);

      const response = await api('patch', `/trips/${trip.id}`, token)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        fields: [{ field: 'body' }],
      });
    });

    it('only lets the driver of the trip change it (403 NOT_TRIP_DRIVER)', async () => {
      const ana = await readyDriver('ana');
      const bob = await readyDriver('bob');
      const trip = await publishTrip(ana.token, ana.vehicleId);

      const response = await api('patch', `/trips/${trip.id}`, bob.token)
        .send({ offeredSeats: 1 })
        .expect(403);

      expect(response.body).toMatchObject({ code: 'NOT_TRIP_DRIVER' });
    });

    it('cancels a trip, and cancelling again is not allowed', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const trip = await publishTrip(token, vehicleId);

      const cancelled = await api(
        'post',
        `/trips/${trip.id}/cancel`,
        token,
      ).expect(200);
      const again = await api('post', `/trips/${trip.id}/cancel`, token).expect(
        409,
      );

      expect(cancelled.body).toMatchObject({ status: 'cancelled' });
      expect(again.body).toMatchObject({ code: 'INVALID_TRIP_TRANSITION' });
    });
  });
});
