import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Recogida en puntos (docs/diseno-modos-recogida-y-vuelta.md): el conductor
// publica sus paradas hacia el campus, el pasajero las encuentra al buscar y
// pide plaza en una; solo las paradas con alguien suman su tiempo. Las cifras
// valen igual con OSRM (en local) que con la ruta estimada (en el CI)
const EMAIL_PREFIX = 'pickup-stops-e2e-';
const PASSWORD = 'secret-password';
const MINUTES = 60 * 1000;
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
// En el camino al campus: una cerca de la salida y otra cerca del campus
const NEAR_START = { type: 'Point', coordinates: [-2.455, 36.837] };
const NEAR_CAMPUS = { type: 'Point', coordinates: [-2.42, 36.832] };
// Lejos de la ruta (Roquetas de Mar)
const FAR_AWAY = { type: 'Point', coordinates: [-2.6, 36.76] };

interface StopBody {
  id: string;
  position: number;
  name: string;
  estimatedAt: string;
}

interface TripBody {
  id: string;
  pickupMode: string;
  maxDetourM: number | null;
  stops: StopBody[];
}

interface RequestBody {
  id: string;
  stopId: string | null;
  pickupName: string;
  pickupAt: string;
}

describe('Picking up at stops (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let campus: unknown;

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
    method: 'get' | 'post' | 'patch',
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

  // Un conductor listo para publicar, con su vehículo, hacia el parking P1
  async function readyDriver(): Promise<{
    driver: string;
    publish: (body: Record<string, unknown>) => request.Test;
  }> {
    const driver = await tokenFor('dan', ['driver']);
    await request(app.getHttpServer())
      .put('/api/users/me/driver-declaration')
      .set('Authorization', `Bearer ${driver}`)
      .expect(200);
    const vehicle = await api('post', '/vehicles', driver)
      .send({
        plate: '9812BCD',
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      })
      .expect(201);
    const parking = await api('get', '/campus-parkings/p1', driver).expect(200);
    campus = (parking.body as { location: unknown }).location;
    const departureAt = new Date(Date.now() + 24 * 60 * MINUTES);
    return {
      driver,
      publish: (body) =>
        api('post', '/trips', driver).send({
          vehicleId: (vehicle.body as { id: string }).id,
          origin: ALMERIA_CENTRE,
          destination: campus,
          departureAt: departureAt.toISOString(),
          offeredSeats: 3,
          maxDetourMin: 20,
          ...body,
        }),
    };
  }

  // Los dos puntos, dados al revés: el backend los ordena por la ruta
  const STOPS = [
    { name: 'Cerca del campus', location: NEAR_CAMPUS },
    { name: 'Cerca de la salida', location: NEAR_START },
  ];

  async function tripWithStops(): Promise<{ driver: string; trip: TripBody }> {
    const { driver, publish } = await readyDriver();
    const published = await publish({
      pickupMode: 'stops',
      stops: STOPS,
    }).expect(201);
    return { driver, trip: published.body as TripBody };
  }

  async function requestAt(
    name: string,
    tripId: string,
    stopId: string,
  ): Promise<{ passenger: string; body: RequestBody }> {
    const passenger = await tokenFor(name, ['passenger']);
    const created = await api('post', `/trips/${tripId}/requests`, passenger)
      .send({ direction: 'to-campus', stopId })
      .expect(201);
    return { passenger, body: created.body as RequestBody };
  }

  it('publishes the stops in order along the route, with their times', async () => {
    const { driver, trip } = await tripWithStops();

    expect(trip).toMatchObject({ pickupMode: 'stops', maxDetourM: null });
    expect(trip.stops.map(({ name, position }) => [position, name])).toEqual([
      [0, 'Cerca de la salida'],
      [1, 'Cerca del campus'],
    ]);
    const [first, second] = trip.stops.map(({ estimatedAt }) =>
      new Date(estimatedAt).getTime(),
    );
    expect(second).toBeGreaterThan(first);
    // El Gemelo Digital recibe las paradas con el viaje
    const [event] = await dataSource.query<
      { payload: { stops: StopBody[] }; version: number }[]
    >(
      `SELECT payload, version FROM events
        WHERE type = 'trip.published' AND source_entity_id = $1`,
      [trip.id],
    );
    expect(event.version).toBe(3);
    expect(event.payload.stops.map(({ id }) => id)).toEqual(
      trip.stops.map(({ id }) => id),
    );

    // Las paradas dependen de la ruta: no se puede mover el viaje ni ponerle
    // los metros de la recogida en ruta
    for (const change of [{ origin: NEAR_START }, { maxDetourM: 300 }]) {
      const refused = await api('patch', `/trips/${trip.id}`, driver)
        .send(change)
        .expect(400);
      expect(refused.body).toMatchObject({ code: 'INVALID_STOPS' });
    }
  });

  it('refuses stops that do not fit the pickup mode or the detour', async () => {
    const { publish } = await readyDriver();

    const onRoute = await publish({ stops: STOPS }).expect(400);
    expect(onRoute.body).toMatchObject({ code: 'INVALID_STOPS' });
    const withMetres = await publish({
      pickupMode: 'stops',
      stops: STOPS,
      maxDetourM: 500,
    }).expect(400);
    expect(withMetres.body).toMatchObject({ code: 'INVALID_STOPS' });
    const fromCampus = await publish({
      pickupMode: 'stops',
      stops: STOPS,
      origin: campus,
      destination: ALMERIA_CENTRE,
    }).expect(400);
    expect(fromCampus.body).toMatchObject({ code: 'INVALID_STOPS' });
    const tooFar = await publish({
      pickupMode: 'stops',
      stops: [{ name: 'Roquetas', location: FAR_AWAY }],
      maxDetourMin: 1,
    }).expect(400);
    expect(tooFar.body).toMatchObject({ code: 'STOPS_EXCEED_DETOUR' });
    await publish({ pickupMode: 'stops', stops: [] }).expect(400);
  });

  it('finds the trip by its nearest stop', async () => {
    const { trip } = await tripWithStops();
    const passenger = await tokenFor('pia', ['passenger']);
    const departure = new Date(trip.stops[0].estimatedAt);

    const response = await api('post', '/trips/search', passenger)
      .send({
        place: { type: 'Point', coordinates: [-2.4205, 36.8325] },
        parkingId: 'p1',
        direction: 'to-campus',
        desiredAt: new Date(departure.getTime() + 20 * MINUTES),
        marginMin: 60,
      })
      .expect(200);

    const match = (
      response.body as { id: string; stop: { id: string } | null }[]
    ).find(({ id }) => id === trip.id);
    expect(match?.stop).toMatchObject({
      id: trip.stops[1].id,
      name: 'Cerca del campus',
    });
  });

  it('asks for a stop of the trip when requesting a seat', async () => {
    const { trip } = await tripWithStops();
    const passenger = await tokenFor('pia', ['passenger']);
    const ask = (body: Record<string, unknown>) =>
      api('post', `/trips/${trip.id}/requests`, passenger)
        .send({ direction: 'to-campus', ...body })
        .expect(400);

    expect(
      (
        await ask({
          pickupLocation: NEAR_START,
          pickupName: 'Mi portal',
        })
      ).body,
    ).toMatchObject({ code: 'STOP_REQUIRED' });
    expect(
      (await ask({ stopId: '00000000-0000-4000-8000-000000000000' })).body,
    ).toMatchObject({ code: 'STOP_NOT_IN_TRIP' });
  });

  it('picks up at the stop and adds its time only once', async () => {
    const { driver, trip } = await tripWithStops();
    const [first, second] = trip.stops;
    const pia = await requestAt('pia', trip.id, first.id);
    expect(pia.body).toMatchObject({
      stopId: first.id,
      pickupName: 'Cerca de la salida',
      pickupAt: first.estimatedAt,
    });

    await api('post', `/requests/${pia.body.id}/accept`, driver)
      .send()
      .expect(200);
    // Alguien sube en la primera: la segunda se retrasa su tiempo de parada
    const afterPia = await api('get', `/trips/${trip.id}`, driver).expect(200);
    const delayedMs =
      new Date((afterPia.body as TripBody).stops[1].estimatedAt).getTime() -
      new Date(second.estimatedAt).getTime();
    expect(delayedMs).toBe(2 * MINUTES);

    // Otro en la misma parada no la vuelve a sumar
    const leo = await requestAt('leo', trip.id, first.id);
    await api('post', `/requests/${leo.body.id}/accept`, driver)
      .send()
      .expect(200);
    const afterLeo = await api('get', `/trips/${trip.id}`, driver).expect(200);
    expect((afterLeo.body as TripBody).stops[1].estimatedAt).toBe(
      (afterPia.body as TripBody).stops[1].estimatedAt,
    );
  });
});
