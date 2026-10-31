import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Búsqueda de viajes (matching, RF-06, RF-07) de punta a punta: un conductor
// publica un viaje del centro de Almería al campus y un pasajero que vive en
// el camino lo encuentra. Funciona con OSRM o con la ruta estimada
const EMAIL_PREFIX = 'matching-e2e-';
const PASSWORD = 'secret-password';
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
// A mitad de camino entre el centro y el campus
const ON_THE_WAY = { type: 'Point', coordinates: [-2.435, 36.834] };
// Roquetas de Mar: a más de 2 km de la ruta
const FAR_AWAY = { type: 'Point', coordinates: [-2.6, 36.76] };
const MINUTES = 60_000;

interface TripMatchBody {
  id: string;
  driver: { name: string; tripCount: number };
  vehicle: { brand: string; model: string; color: string };
  offeredSeats: number;
  availableSeats: number;
  detourMin: number;
  score: number;
}

describe('Matching API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let tripId: string;
  let departureAt: Date;
  let passengerToken: string;
  let driverToken: string;
  let vehicleId: string;
  let campusLocation: unknown;

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
    driverToken = await tokenFor('lucia', ['driver']);
    await api('put', '/users/me/driver-declaration', driverToken).expect(200);
    const vehicle = await api('post', '/vehicles', driverToken)
      .send({
        plate: '9900BCD',
        capacity: 3,
        brand: 'Toyota',
        model: 'Yaris',
        color: 'red',
        engine: 'hybrid',
      })
      .expect(201);
    vehicleId = (vehicle.body as { id: string }).id;
    const parking = await api('get', '/campus-parkings/p1', driverToken).expect(
      200,
    );
    campusLocation = (parking.body as { location: unknown }).location;
    // Mañana a la misma hora: siempre en el futuro
    departureAt = new Date(Date.now() + 24 * 60 * MINUTES);
    const trip = await api('post', '/trips', driverToken)
      .send({
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: (parking.body as { location: unknown }).location,
        departureAt,
        offeredSeats: 2,
        maxDetourMin: 15,
      })
      .expect(201);
    tripId = (trip.body as { id: string }).id;
    passengerToken = await tokenFor('mario', ['passenger']);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  function api(
    method: 'get' | 'post' | 'put',
    path: string,
    token: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function tokenFor(name: string, profiles: string[]): Promise<string> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, { name, email, password: PASSWORD, profiles });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }

  // Llegar al campus ~20 min después de la salida, con margen de una hora
  function search(overrides: Record<string, unknown> = {}): request.Test {
    return api('post', '/trips/search', passengerToken).send({
      place: ON_THE_WAY,
      parkingId: 'p1',
      direction: 'to-campus',
      desiredAt: new Date(departureAt.getTime() + 20 * MINUTES),
      marginMin: 60,
      ...overrides,
    });
  }

  it('finds the trip that passes near the passenger', async () => {
    const response = await search().expect(200);

    const matches = response.body as TripMatchBody[];
    const match = matches.find(({ id }) => id === tripId);
    expect(match).toMatchObject({
      '@type': 'TripMatch',
      href: `/api/trips/${tripId}`,
      driver: {
        name: 'lucia',
        avatarKey: null,
        tripCount: 0,
        preferences: {
          conversation: null,
          music: null,
          smoking: null,
          pets: null,
        },
      },
      vehicle: {
        brand: 'Toyota',
        model: 'Yaris',
        color: 'red',
      },
      availableSeats: 2,
      offeredSeats: 2,
    });
    // La matrícula solo la ve el pasajero con la plaza aceptada
    expect(match?.vehicle).not.toHaveProperty('plate');
    expect(match?.detourMin).toBeLessThanOrEqual(15);
    expect(match?.score).toBeGreaterThan(0);
    expect(response.headers['x-result-count']).toBe(String(matches.length));
  });

  it('leaves out trips far from the address, the other way or without seats', async () => {
    const ids = async (overrides: Record<string, unknown>) =>
      ((await search(overrides).expect(200)).body as TripMatchBody[]).map(
        ({ id }) => id,
      );

    expect(await ids({ place: FAR_AWAY })).not.toContain(tripId);
    expect(await ids({ direction: 'from-campus' })).not.toContain(tripId);
    expect(await ids({ seats: 3 })).not.toContain(tripId);
  });

  it('returns offered seats and the driver completed-trip count', async () => {
    await dataSource.query(
      "UPDATE trips SET status = 'finished', departure_at = now() - interval '1 hour' WHERE id = $1",
      [tripId],
    );
    const nextTrip = await api('post', '/trips', driverToken)
      .send({
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: campusLocation,
        departureAt: new Date(Date.now() + 24 * 60 * MINUTES),
        offeredSeats: 3,
        maxDetourMin: 15,
      })
      .expect(201);

    const response = await search().expect(200);
    const match = (response.body as TripMatchBody[]).find(
      ({ id }) => id === (nextTrip.body as { id: string }).id,
    );

    expect(match).toMatchObject({
      driver: { tripCount: 1 },
      availableSeats: 3,
      offeredSeats: 3,
    });
  });

  it('rejects an unknown parking and invalid searches', async () => {
    const notFound = await search({ parkingId: 'p99' }).expect(404);
    expect((notFound.body as { code: string }).code).toBe(
      'CAMPUS_PARKING_NOT_FOUND',
    );
    await search({ direction: 'sideways' }).expect(400);
  });
});
