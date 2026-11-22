import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { Point } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { savedCo2Kg, sharedKm } from '../src/modules/metrics/saved-co2';
import { RequestsService } from '../src/modules/requests/requests.service';
import { OsrmClient } from '../src/modules/trips/osrm.client';
import type { RoutePlan } from '../src/modules/trips/route-plan';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// «Tus viajes» por pestañas y páginas (los viajes que conduce y sus
// solicitudes de pasajero, juntos) y el impacto con los dos papeles. OSRM se
// sustituye por uno falso. Los usuarios llevan el prefijo EMAIL_PREFIX y se
// borran con todo lo suyo
const EMAIL_PREFIX = 'trip-entries-e2e-';
const PASSWORD = 'secret-password';
const DAY_MIN = 24 * 60;
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};

interface Session {
  id: string;
  accessToken: string;
}

interface EntryBody {
  '@type': string;
  role: 'driver' | 'passenger';
  trip?: { id: string };
  request?: { id: string };
}

describe('My trip entries (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OsrmClient)
      .useValue({
        route: (from: Point, to: Point): Promise<RoutePlan> =>
          Promise.resolve({
            distanceKm: 6.5,
            durationMin: 12,
            geometry: {
              type: 'LineString',
              coordinates: [from.coordinates, to.coordinates],
            },
            source: 'osrm',
          }),
      })
      .compile();
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

  async function sessionFor(
    name: string,
    profiles: string[],
  ): Promise<Session> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, { name, email, password: PASSWORD, profiles });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, accessToken: body.accessToken };
  }

  // Un viaje publicado por el conductor, que sale dentro de esos minutos
  async function publishTrip(
    driverId: string,
    { plate, inMinutes }: { plate: string; inMinutes: number },
  ): Promise<string> {
    await app.get(UsersService).declareDriverLicense(driverId);
    const vehicle = await app.get(VehiclesService).register(driverId, {
      plate,
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const { trip } = await app.get(TripsService).publish(driverId, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    await setDepartureIn(dataSource, trip.id, inMinutes);
    return trip.id;
  }

  async function setTrip(
    tripId: string,
    changes: { status: string; availableSeats?: number },
  ): Promise<void> {
    await dataSource.query(
      // Terminado, con la hora de inicio que exige la tabla
      `UPDATE trips SET status = $1::trip_status, available_seats = COALESCE($2, available_seats),
         started_at = CASE WHEN $1::trip_status = 'finished' THEN departure_at ELSE started_at END
       WHERE id = $3`,
      [changes.status, changes.availableSeats ?? null, tripId],
    );
  }

  function list(session: Session, query: string) {
    return request(app.getHttpServer())
      .get(`/api/users/me/trip-entries${query}`)
      .set('Authorization', `Bearer ${session.accessToken}`);
  }

  function ids(body: EntryBody[]): string[] {
    return body.map((entry) => entry.trip?.id ?? entry.request?.id ?? '');
  }

  // dan conduce (un viaje mañana, otro hecho y otro cancelado) y va de
  // pasajero en el de pia, que sale antes que el suyo
  async function setUp(): Promise<{
    dan: Session;
    upcomingTripId: string;
    pastTripId: string;
    cancelledTripId: string;
    seatId: string;
    piaTripId: string;
  }> {
    const [dan, pia] = await Promise.all([
      sessionFor('dan', ['driver', 'passenger']),
      sessionFor('pia', ['driver']),
    ]);
    const pastTripId = await publishTrip(dan.id, {
      plate: '1111BCD',
      inMinutes: 3 * DAY_MIN,
    });
    const cancelledTripId = await publishTrip(dan.id, {
      plate: '2222BCD',
      inMinutes: 5 * DAY_MIN,
    });
    const upcomingTripId = await publishTrip(dan.id, {
      plate: '3333BCD',
      inMinutes: DAY_MIN,
    });
    const piaTripId = await publishTrip(pia.id, {
      plate: '4444BCD',
      inMinutes: 4 * 60,
    });
    const { request: seat } = await app
      .get(RequestsService)
      .request(dan.id, piaTripId);
    // Ya hechos o cancelados, con la salida en el pasado
    await setDepartureIn(dataSource, pastTripId, -2 * DAY_MIN);
    await setTrip(pastTripId, { status: 'finished', availableSeats: 0 });
    await setDepartureIn(dataSource, cancelledTripId, -DAY_MIN);
    await setTrip(cancelledTripId, { status: 'cancelled' });
    return {
      dan,
      upcomingTripId,
      pastTripId,
      cancelledTripId,
      seatId: seat.id,
      piaTripId,
    };
  }

  it('lists each tab with both profiles together, by departure and in pages', async () => {
    const { dan, upcomingTripId, pastTripId, cancelledTripId, seatId } =
      await setUp();

    // Próximos: primero su plaza en el de pia (sale antes), luego el suyo
    const upcoming = await list(dan, '?tab=upcoming').expect(200);
    expect(upcoming.headers['x-total-count']).toBe('2');
    expect(ids(upcoming.body as EntryBody[])).toEqual([seatId, upcomingTripId]);
    expect(upcoming.body).toMatchObject([
      { '@type': 'TripEntry', role: 'passenger' },
      { '@type': 'TripEntry', role: 'driver' },
    ]);

    // De uno en uno, la segunda página
    const second = await list(dan, '?tab=upcoming&offset=1&limit=1').expect(
      200,
    );
    expect(second.headers['x-total-count']).toBe('2');
    expect(ids(second.body as EntryBody[])).toEqual([upcomingTripId]);

    // Sin tab, Próximos
    const byDefault = await list(dan, '').expect(200);
    expect(ids(byDefault.body as EntryBody[])).toEqual([
      seatId,
      upcomingTripId,
    ]);

    const past = await list(dan, '?tab=past').expect(200);
    expect(ids(past.body as EntryBody[])).toEqual([pastTripId]);
    const cancelled = await list(dan, '?tab=cancelled').expect(200);
    expect(ids(cancelled.body as EntryBody[])).toEqual([cancelledTripId]);
  });

  it('moves a seat to «Anteriores» once completed, the latest first', async () => {
    const { dan, pastTripId, seatId, piaTripId } = await setUp();
    await setDepartureIn(dataSource, piaTripId, -60);
    await setTrip(piaTripId, { status: 'finished' });
    await dataSource.query(
      "UPDATE requests SET status = 'completed' WHERE id = $1",
      [seatId],
    );

    const past = await list(dan, '?tab=past').expect(200);
    expect(ids(past.body as EntryBody[])).toEqual([seatId, pastTripId]);
  });

  it('rejects an unknown tab', async () => {
    const dan = await sessionFor('dan', ['driver']);

    const response = await list(dan, '?tab=all').expect(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('adds up the impact of both profiles', async () => {
    const { dan, seatId, piaTripId } = await setUp();
    await setTrip(piaTripId, { status: 'finished' });
    await dataSource.query(
      "UPDATE requests SET status = 'completed' WHERE id = $1",
      [seatId],
    );

    const response = await request(app.getHttpServer())
      .get('/api/users/me/impact')
      .set('Authorization', `Bearer ${dan.accessToken}`)
      .expect(200);

    // Como conductor, dos pasajeros en el viaje hecho; como pasajero, uno
    const leg = { origin: ALMERIA_CENTRE, destination: UAL_CAMPUS };
    expect(response.body).toEqual({
      '@type': 'UserImpact',
      href: '/api/users/me/impact',
      tripsDone: 2,
      co2Kg: savedCo2Kg([
        { ...leg, carsAvoided: 2 },
        { ...leg, carsAvoided: 1 },
      ]),
      driverKm: sharedKm([{ ...leg, carsAvoided: 2 }]),
      passengerKm: sharedKm([{ ...leg, carsAvoided: 1 }]),
    });
  });

  it('starts at zero without trips', async () => {
    const leo = await sessionFor('leo', ['passenger']);

    const response = await request(app.getHttpServer())
      .get('/api/users/me/impact')
      .set('Authorization', `Bearer ${leo.accessToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      tripsDone: 0,
      co2Kg: 0,
      driverKm: 0,
      passengerKm: 0,
    });
  });
});
