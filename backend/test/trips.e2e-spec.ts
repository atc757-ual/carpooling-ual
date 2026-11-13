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
// El punto del parking P2 (migración UpdateCampusParkingLocations)
const CAMPUS_PARKING_P2 = {
  type: 'Point',
  coordinates: [-2.404599, 36.827641],
};
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
      .send({
        plate: `${plateNumber}BCD`,
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      })
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

  // Mañana a esa hora UTC (las salidas de los tests de límites, todas el
  // mismo día de Madrid)
  function tomorrowAt(hour: number, minute = 0): string {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    date.setUTCHours(hour, minute, 0, 0);
    return date.toISOString();
  }

  describe('publishing limits of the driver', () => {
    it('rejects a trip that overlaps another active trip (409 TRIP_OVERLAPS)', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      await api('post', '/trips', token)
        .send(tripBody(vehicleId, { departureAt: tomorrowAt(8) }))
        .expect(201);

      const response = await api('post', '/trips', token)
        .send(tripBody(vehicleId, { departureAt: tomorrowAt(8, 5) }))
        .expect(409);

      expect(response.body).toMatchObject({ code: 'TRIP_OVERLAPS' });
    }, 30_000);

    it('allows a trip at the same time once the other is cancelled', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const first = await api('post', '/trips', token)
        .send(tripBody(vehicleId, { departureAt: tomorrowAt(8) }))
        .expect(201);
      await api(
        'post',
        `/trips/${(first.body as { id: string }).id}/cancel`,
        token,
      ).expect(200);

      const response = await api('post', '/trips', token).send(
        tripBody(vehicleId, { departureAt: tomorrowAt(8) }),
      );

      expect(response.status).toBe(201);
    }, 30_000);

    it('rejects moving a trip onto another one, but not onto itself', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      await api('post', '/trips', token)
        .send(tripBody(vehicleId, { departureAt: tomorrowAt(8) }))
        .expect(201);
      const second = await api('post', '/trips', token)
        .send(tripBody(vehicleId, { departureAt: tomorrowAt(12) }))
        .expect(201);
      const secondId = (second.body as { id: string }).id;

      const onto = await api('patch', `/trips/${secondId}`, token)
        .send({ departureAt: tomorrowAt(8, 10) })
        .expect(409);
      const itself = await api('patch', `/trips/${secondId}`, token).send({
        departureAt: tomorrowAt(12, 5),
      });

      expect(onto.body).toMatchObject({ code: 'TRIP_OVERLAPS' });
      expect(itself.status).toBe(200);
    }, 30_000);

    it('allows at most 4 trips on the same day (409 DAILY_TRIP_LIMIT)', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      for (const hour of [7, 9, 11, 13]) {
        await api('post', '/trips', token)
          .send(tripBody(vehicleId, { departureAt: tomorrowAt(hour) }))
          .expect(201);
      }

      const response = await api('post', '/trips', token)
        .send(tripBody(vehicleId, { departureAt: tomorrowAt(15) }))
        .expect(409);

      expect(response.body).toMatchObject({ code: 'DAILY_TRIP_LIMIT' });
    }, 30_000);
  });

  describe('POST /api/trips (RF-04)', () => {
    it('publishes a trip with public vehicle details and no plate', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const body = {
        ...tripBody(vehicleId),
        originName: 'Almería centro',
        destinationName: 'Campus UAL · Parking P1 (Sur)',
      } as { departureAt: string };

      const response = await api('post', '/trips', token)
        .send(body)
        .expect(201);

      const trip = response.body as { id: string; driver: { id: string } };
      expect(response.body).toEqual({
        '@type': 'Trip',
        id: trip.id,
        href: `/api/trips/${trip.id}`,
        driver: {
          id: trip.driver.id,
          name: 'ana',
          avatarKey: null,
          tripCount: 0,
          rating: null,
          preferences: {
            conversation: null,
            music: null,
            smoking: null,
            pets: null,
          },
        },
        vehicleId,
        vehicle: { brand: 'Seat', model: 'Ibiza', color: 'blue' },
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: body.departureAt,
        offeredSeats: 3,
        availableSeats: 3,
        maxDetourMin: 10,
        pickupMode: 'on_route',
        maxDetourM: 500,
        stops: [],
        originName: 'Almería centro',
        destinationName: 'Campus UAL · Parking P1 (Sur)',
        status: 'published',
        startedAt: null,
        isLocationApproximate: false,
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

    // RF-21: sin la declaración del vehículo al día (aquí, como si hubiera
    // cambiado de forma importante: se borra su aceptación) no se publica
    // con él hasta aceptarla otra vez
    it('publishes only with a vehicle whose declaration is up to date', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      await dataSource.query(
        'DELETE FROM user_consents WHERE vehicle_id = $1',
        [vehicleId],
      );

      const blocked = await api('post', '/trips', token)
        .send(tripBody(vehicleId))
        .expect(409);
      expect((blocked.body as { code: string }).code).toBe(
        'VEHICLE_DECLARATION_REQUIRED',
      );
      const listed = await api('get', '/vehicles', token).expect(200);
      expect(listed.body).toEqual([
        expect.objectContaining({ id: vehicleId, isDeclared: false }),
      ]);

      const declared = await api(
        'put',
        `/vehicles/${vehicleId}/declaration`,
        token,
      )
        .send({ version: '1.0' })
        .expect(200);
      expect(declared.body).toMatchObject({ id: vehicleId, isDeclared: true });
      await api('post', '/trips', token).send(tripBody(vehicleId)).expect(201);
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

    // Hacia el campus se elige la llegada: la salida la calcula el backend
    it('publishes with the arrival and computes the departure', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const arrivalAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const response = await api('post', '/trips', token)
        .send(
          tripBody(vehicleId, {
            departureAt: undefined,
            arrivalAt: arrivalAt.toISOString(),
          }),
        )
        .expect(201);

      const { departureAt } = response.body as { departureAt: string };
      expect(new Date(departureAt).getTime()).toBeLessThan(arrivalAt.getTime());
    });

    it('asks for the departure or the arrival, not both nor none', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const arrivalAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();

      const both = await api('post', '/trips', token)
        .send(tripBody(vehicleId, { arrivalAt }))
        .expect(400);
      const none = await api('post', '/trips', token)
        .send(tripBody(vehicleId, { departureAt: undefined }))
        .expect(400);

      const fieldsOf = (body: unknown) =>
        (body as { fields: { field: string }[] }).fields.map(
          ({ field }) => field,
        );
      expect(fieldsOf(both.body)).toEqual(['arrivalAt']);
      expect(new Set(fieldsOf(none.body))).toEqual(
        new Set(['departureAt', 'arrivalAt']),
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

      expect(response.body).toMatchObject({
        id: trip.id,
        status: 'published',
        driver: { tripCount: 0, rating: null },
        vehicle: { brand: 'Seat', model: 'Ibiza', color: 'blue' },
        offeredSeats: 3,
        availableSeats: 3,
      });
      expect(JSON.stringify(response.body)).not.toContain('BCD');
    });

    // El origen suele ser la casa del conductor: quien no tiene plaza lo ve
    // redondeado a unos 500 m; los parkings del campus, tal cual
    it('rounds the home of the driver for whoever has no seat, but not the campus parking', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const passenger = await tokenFor('pia', ['passenger']);
      const created = await api('post', '/trips', token)
        .send(
          tripBody(vehicleId, {
            destination: CAMPUS_PARKING_P2,
            originName: 'Calle Profesor Mulian, 29',
          }),
        )
        .expect(201);
      const tripId = (created.body as { id: string }).id;

      const seenBySearcher = await api(
        'get',
        `/trips/${tripId}`,
        passenger,
      ).expect(200);
      expect(seenBySearcher.body).toMatchObject({
        origin: { type: 'Point', coordinates: [-2.465, 36.84] },
        originName: 'Calle Profesor Mulian',
        destination: CAMPUS_PARKING_P2,
        isLocationApproximate: true,
      });

      // En la app, un administrador ve lo mismo que cualquier pasajero (los
      // datos exactos, solo en el panel)
      const adela = await registerUser(app, {
        name: 'adela',
        email: `${EMAIL_PREFIX}adela@ual.es`,
        password: PASSWORD,
        profiles: ['passenger'],
      });
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [adela],
      );
      const admin = (
        (
          await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: `${EMAIL_PREFIX}adela@ual.es`, password: PASSWORD })
            .expect(200)
        ).body as { accessToken: string }
      ).accessToken;
      const seenByAdmin = await api('get', `/trips/${tripId}`, admin).expect(
        200,
      );
      expect(seenByAdmin.body).toMatchObject({
        originName: 'Calle Profesor Mulian',
        isLocationApproximate: true,
      });

      const seenByDriver = await api('get', `/trips/${tripId}`, token).expect(
        200,
      );
      expect(seenByDriver.body).toMatchObject({
        origin: ALMERIA_CENTRE,
        originName: 'Calle Profesor Mulian, 29',
        isLocationApproximate: false,
      });
    });

    it('shows the driver average after three published reviews', async () => {
      const { token, vehicleId } = await readyDriver('ana');
      const trip = await publishTrip(token, vehicleId);
      await dataSource.query(
        `UPDATE driver_profiles
         SET average_rating = 4.8, rating_count = 3
         WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
        [`${EMAIL_PREFIX}ana@ual.es`],
      );

      const response = await api('get', `/trips/${trip.id}`, token).expect(200);

      expect(response.body).toMatchObject({ driver: { rating: 4.8 } });
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
      // A horas distintas: un conductor no puede tener dos viajes a la vez
      for (const hour of [8, 14]) {
        await api('post', '/trips', token)
          .send(tripBody(vehicleId, { departureAt: tomorrowAt(hour) }))
          .expect(201);
      }

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
