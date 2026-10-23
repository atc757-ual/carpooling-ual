import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { Point } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { RequestsService } from '../src/modules/requests/requests.service';
import { OsrmClient } from '../src/modules/trips/osrm.client';
import type { RoutePlan } from '../src/modules/trips/route-plan';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { deleteTestUsers } from './support/cleanup';

// Seguimiento real del viaje (RF-12) de punta a punta. OSRM se sustituye por
// uno falso. Los usuarios llevan el prefijo EMAIL_PREFIX y se borran con todo
// lo suyo (las posiciones caen en cascada con el viaje)
const EMAIL_PREFIX = 'tracking-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};
const ON_THE_WAY: Point = { type: 'Point', coordinates: [-2.43, 36.833] };
const MINUTE_MS = 60 * 1000;

interface Session {
  id: string;
  token: string;
}

describe('Trip tracking (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let tripsService: TripsService;
  const osrm = { route: jest.fn<Promise<RoutePlan>, [Point, Point]>() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OsrmClient)
      .useValue(osrm)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    tripsService = app.get(TripsService);
  });

  beforeEach(() => {
    osrm.route.mockImplementation((from, to) =>
      Promise.resolve({
        distanceKm: 3.2,
        durationMin: 5,
        geometry: {
          type: 'LineString',
          coordinates: [from.coordinates, to.coordinates],
        },
        source: 'osrm',
      }),
    );
  });

  afterEach(async () => {
    osrm.route.mockReset();
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
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name, email, password: PASSWORD, profiles })
      .expect(201);
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, token: body.accessToken };
  }

  // Viaje de dan con pia aceptada; si started, ya en curso
  async function tripWithPassenger(started = true) {
    const dan = await sessionFor('dan', ['driver']);
    await app.get(UsersService).declareDriverLicense(dan.id);
    const vehicle = await app
      .get(VehiclesService)
      .register(dan.id, { plate: '9926BCD', capacity: 4 });
    const { trip } = await tripsService.publish(dan.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: new Date(Date.now() + 10 * MINUTE_MS),
      offeredSeats: 2,
    });
    const pia = await sessionFor('pia', ['passenger']);
    const requestsService = app.get(RequestsService);
    const { request: seat } = await requestsService.request(pia.id, trip.id);
    await requestsService.accept(dan.id, seat.id);
    if (started) {
      await tripsService.start(dan.id, trip.id);
    }
    return { dan, pia, tripId: trip.id };
  }

  function report(tripId: string, session: Session, position: unknown) {
    return request(app.getHttpServer())
      .post(`/api/trips/${tripId}/positions`)
      .set('Authorization', `Bearer ${session.token}`)
      .send({ position });
  }

  function latest(tripId: string, session: Session) {
    return request(app.getHttpServer())
      .get(`/api/trips/${tripId}/position`)
      .set('Authorization', `Bearer ${session.token}`);
  }

  // Simula que la última posición se envió hace un minuto
  function ageLastPosition(tripId: string) {
    return dataSource.query(
      "UPDATE trip_positions SET recorded_at = recorded_at - interval '1 minute' WHERE trip_id = $1",
      [tripId],
    );
  }

  it('the driver reports a position with what remains, and it feeds the digital twin', async () => {
    const { dan, tripId } = await tripWithPassenger();

    const response = await report(tripId, dan, ON_THE_WAY).expect(201);

    const body = response.body as { recordedAt: string };
    expect(osrm.route).toHaveBeenLastCalledWith(ON_THE_WAY, UAL_CAMPUS);
    expect(response.headers.location).toBe(`/api/trips/${tripId}/position`);
    expect(response.body).toEqual({
      '@type': 'TripPosition',
      href: `/api/trips/${tripId}/position`,
      tripId,
      position: ON_THE_WAY,
      recordedAt: expect.any(String) as string,
      remainingKm: 3.2,
      remainingMin: 5,
      remainingSource: 'osrm',
      estimatedArrivalAt: new Date(
        new Date(body.recordedAt).getTime() + 5 * MINUTE_MS,
      ).toISOString(),
    });
    const event = await dataSource.manager.findOneBy(DomainEvent, {
      sourceEntityId: tripId,
      type: 'trip.position_updated',
    });
    expect(event?.payload).toMatchObject({
      position: ON_THE_WAY,
      remainingKm: 3.2,
      remainingMin: 5,
    });
  });

  it('only the driver and the accepted passengers see the position', async () => {
    const { dan, pia, tripId } = await tripWithPassenger();
    const leo = await sessionFor('leo', ['passenger']);
    await report(tripId, dan, ON_THE_WAY).expect(201);

    await latest(tripId, dan).expect(200);
    const asPassenger = await latest(tripId, pia).expect(200);
    const asStranger = await latest(tripId, leo).expect(403);

    expect(asPassenger.body).toMatchObject({ position: ON_THE_WAY });
    expect(asStranger.body).toMatchObject({ code: 'NOT_TRIP_PASSENGER' });
  });

  it('accepts at most one position every POSITION_MIN_INTERVAL_SECONDS', async () => {
    const { dan, pia, tripId } = await tripWithPassenger();
    await report(tripId, dan, ALMERIA_CENTRE).expect(201);

    const tooSoon = await report(tripId, dan, ON_THE_WAY).expect(409);
    await ageLastPosition(tripId);
    await report(tripId, dan, ON_THE_WAY).expect(201);

    expect(tooSoon.body).toMatchObject({ code: 'POSITION_TOO_FREQUENT' });
    const current = await latest(tripId, pia).expect(200);
    expect(current.body).toMatchObject({ position: ON_THE_WAY });
  });

  it('only the driver of a trip in progress reports, with a valid point', async () => {
    const { dan, pia, tripId } = await tripWithPassenger(false);
    const eva = await sessionFor('eva', ['driver']);

    const notStarted = await report(tripId, dan, ON_THE_WAY).expect(409);
    const notDriver = await report(tripId, eva, ON_THE_WAY).expect(403);
    const notADriver = await report(tripId, pia, ON_THE_WAY).expect(403);
    const badPoint = await report(tripId, dan, {
      type: 'Point',
      coordinates: [200, 36.8],
    }).expect(400);

    expect(notStarted.body).toMatchObject({ code: 'TRIP_NOT_IN_PROGRESS' });
    expect(notDriver.body).toMatchObject({ code: 'NOT_TRIP_DRIVER' });
    expect(notADriver.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
    expect(badPoint.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(osrm.route).toHaveBeenCalledTimes(1); // solo al publicar
  });

  it('there is no position before the first report, and the track is deleted when the trip ends', async () => {
    const { dan, pia, tripId } = await tripWithPassenger();
    const before = await latest(tripId, pia).expect(404);
    await report(tripId, dan, ALMERIA_CENTRE).expect(201);
    await ageLastPosition(tripId);
    await report(tripId, dan, ON_THE_WAY).expect(201);

    await tripsService.finish(dan.id, tripId);

    const after = await latest(tripId, pia).expect(404);
    expect(before.body).toMatchObject({ code: 'POSITION_NOT_FOUND' });
    expect(after.body).toMatchObject({ code: 'POSITION_NOT_FOUND' });
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM trip_positions WHERE trip_id = $1',
      [tripId],
    );
    expect(count).toBe('0');
  });
});
