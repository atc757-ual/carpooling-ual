import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { Point } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RequestsService } from '../src/modules/requests/requests.service';
import { OsrmClient } from '../src/modules/trips/osrm.client';
import type { RoutePlan } from '../src/modules/trips/route-plan';
import { TripAutoFinishService } from '../src/modules/trips/trip-auto-finish.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// Cierre automático: un viaje en curso que nadie termina pasa a finalizado
// 1 h después de su llegada estimada (salida + duración de la ruta), marcado
// como cerrado por el sistema, con sus plazas cerradas y el aviso al
// conductor. OSRM se sustituye por uno falso (rutas de 30 min). Los usuarios
// llevan el prefijo EMAIL_PREFIX y se borran con todo lo suyo
const EMAIL_PREFIX = 'auto-finish-e2e-';
const PASSWORD = 'secret-password';
const ROUTE_MIN = 30;
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};

describe('Trip auto finish (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OsrmClient)
      .useValue({
        route: (from: Point, to: Point): Promise<RoutePlan> =>
          Promise.resolve({
            distanceKm: 6.5,
            durationMin: ROUTE_MIN,
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

  async function userId(name: string, profiles: string[]): Promise<string> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, { name, email, password: PASSWORD, profiles });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (response.body as { user: { id: string } }).user.id;
  }

  // Un viaje de dan, en curso con pia a bordo, que salió hace esos minutos
  async function tripStartedAgo(
    minutes: number,
  ): Promise<{ tripId: string; driverId: string; seatId: string }> {
    const [driverId, passengerId] = await Promise.all([
      userId('dan', ['driver']),
      userId('pia', ['passenger']),
    ]);
    await app.get(UsersService).declareDriverLicense(driverId);
    const vehicle = await app.get(VehiclesService).register(driverId, {
      plate: '9929BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const requests = app.get(RequestsService);
    const { trip } = await app.get(TripsService).publish(driverId, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    await setDepartureIn(dataSource, trip.id, 20);
    const { request: seat } = await requests.request(passengerId, trip.id);
    await requests.accept(driverId, seat.id);
    await setDepartureIn(dataSource, trip.id, 5);
    await app.get(TripsService).start(driverId, trip.id);
    const [{ code }] = await dataSource.query<{ code: string }[]>(
      'SELECT board_code AS code FROM requests WHERE id = $1',
      [seat.id],
    );
    await requests.board(driverId, seat.id, code);
    // Salió hace esos minutos (y empezó a su hora)
    const departureAt = await setDepartureIn(dataSource, trip.id, -minutes);
    await dataSource.query('UPDATE trips SET started_at = $1 WHERE id = $2', [
      departureAt,
      trip.id,
    ]);
    return { tripId: trip.id, driverId, seatId: seat.id };
  }

  async function rowOf(
    tripId: string,
  ): Promise<{ status: string; finished_by: string | null }> {
    const [row] = await dataSource.query<
      { status: string; finished_by: string | null }[]
    >('SELECT status, finished_by FROM trips WHERE id = $1', [tripId]);
    return row;
  }

  it('closes a trip nobody finished 1 h after its estimated arrival', async () => {
    // Llegada estimada hace 61 min: salida hace 91 min + 30 de ruta
    const { tripId, driverId, seatId } = await tripStartedAgo(ROUTE_MIN + 61);

    const closed = await app.get(TripAutoFinishService).finishAbandonedTrips();

    expect(closed).toBeGreaterThanOrEqual(1);
    expect(await rowOf(tripId)).toEqual({
      status: 'finished',
      finished_by: 'system',
    });
    // La plaza abierta se cierra, marcada como bajada por el sistema
    const [seat] = await dataSource.query<
      { status: string; dropped_off_by: string }[]
    >('SELECT status, dropped_off_by FROM requests WHERE id = $1', [seatId]);
    expect(seat).toEqual({ status: 'completed', dropped_off_by: 'system' });
    // Y el conductor recibe el aviso
    const notices = await dataSource.query<{ type: string }[]>(
      'SELECT type FROM notifications WHERE user_id = $1',
      [driverId],
    );
    expect(notices.map(({ type }) => type)).toContain('trip_auto_finished');
  });

  it('leaves a trip that still has time before the hour after arrival', async () => {
    // Llegada estimada hace 30 min: aún le quedan 30
    const { tripId } = await tripStartedAgo(ROUTE_MIN + 30);

    await app.get(TripAutoFinishService).finishAbandonedTrips();

    expect(await rowOf(tripId)).toEqual({
      status: 'in_progress',
      finished_by: null,
    });
  });
});
