import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import type { LineString, Point } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RequestsService } from '../src/modules/requests/requests.service';
import {
  OsrmClient,
  OsrmUnavailableError,
} from '../src/modules/trips/osrm.client';
import type { RoutePlan } from '../src/modules/trips/route-plan';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';
import { registerUser } from './support/accounts';

// Ruta del viaje (RF-12, CU-08) de punta a punta. OSRM se sustituye por uno
// falso: el resultado no depende de que OSRM esté levantado (en el CI no lo
// está). Los usuarios llevan el prefijo EMAIL_PREFIX y se borran con lo suyo
const EMAIL_PREFIX = 'trip-routes-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};
const AIRPORT: Point = { type: 'Point', coordinates: [-2.3701, 36.8439] };
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const MINUTE_MS = 60 * 1000;

function osrmRoute(to: Point): RoutePlan {
  const geometry: LineString = {
    type: 'LineString',
    coordinates: [ALMERIA_CENTRE.coordinates, [-2.43, 36.833], to.coordinates],
  };
  return { distanceKm: 7.76, durationMin: 11, geometry, source: 'osrm' };
}

describe('Trip routes (e2e)', () => {
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
    osrm.route.mockImplementation((_origin, destination) =>
      Promise.resolve(osrmRoute(destination)),
    );
  });

  afterEach(async () => {
    osrm.route.mockReset();
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function sessionFor(name: string, profiles: string[]) {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles,
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, token: body.accessToken };
  }

  // Viaje de dan que sale en 10 minutos (se puede iniciar ya)
  async function publishTrip() {
    const dan = await sessionFor('dan', ['driver']);
    await app.get(UsersService).declareDriverLicense(dan.id);
    const vehicle = await app
      .get(VehiclesService)
      .register(dan.id, { plate: '9925BCD', capacity: 4 });
    const { trip } = await tripsService.publish(dan.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    // Sale en 10 minutos (publicado con la antelación mínima y movido)
    trip.departureAt = await setDepartureIn(dataSource, trip.id, 10);
    return { dan, trip };
  }

  function getRoute(tripId: string, token: string) {
    return request(app.getHttpServer())
      .get(`/api/trips/${tripId}/route`)
      .set('Authorization', `Bearer ${token}`);
  }

  it('publishing calculates the road route with OSRM; anyone who can see the trip sees it', async () => {
    const { trip } = await publishTrip();
    const pia = await sessionFor('pia', ['passenger']);

    const response = await getRoute(trip.id, pia.token).expect(200);

    expect(osrm.route).toHaveBeenCalledWith(ALMERIA_CENTRE, UAL_CAMPUS);
    expect(response.body).toEqual({
      '@type': 'TripRoute',
      href: `/api/trips/${trip.id}/route`,
      tripId: trip.id,
      distanceKm: 7.76,
      durationMin: 11,
      geometry: osrmRoute(UAL_CAMPUS).geometry,
      source: 'osrm',
      tripStatus: 'published',
      startedAt: null,
      estimatedArrivalAt: new Date(
        trip.departureAt.getTime() + 11 * MINUTE_MS,
      ).toISOString(),
    });
  });

  it('if OSRM does not answer, the trip is published with an estimated route', async () => {
    osrm.route.mockRejectedValue(new OsrmUnavailableError('fetch failed'));
    const { dan, trip } = await publishTrip();

    const response = await getRoute(trip.id, dan.token).expect(200);

    expect(response.body).toMatchObject({
      source: 'estimated',
      geometry: {
        type: 'LineString',
        coordinates: [ALMERIA_CENTRE.coordinates, UAL_CAMPUS.coordinates],
      },
    });
  });

  it('changing the destination recalculates the route; other changes keep it', async () => {
    const { dan, trip } = await publishTrip();

    await tripsService.update(dan.id, trip.id, { offeredSeats: 3 });
    await tripsService.update(dan.id, trip.id, { destination: AIRPORT });

    expect(osrm.route).toHaveBeenCalledTimes(2);
    expect(osrm.route).toHaveBeenLastCalledWith(ALMERIA_CENTRE, AIRPORT);
    const response = await getRoute(trip.id, dan.token).expect(200);
    expect(response.body).toMatchObject({
      geometry: osrmRoute(AIRPORT).geometry,
    });
  });

  it('once started, the arrival is estimated from the start; once over, there is none', async () => {
    const { dan, trip } = await publishTrip();
    const pia = await sessionFor('pia', ['passenger']);
    const requestsService = app.get(RequestsService);
    const { request: seat } = await requestsService.request(pia.id, trip.id);
    await requestsService.accept(dan.id, seat.id);

    const { trip: started } = await tripsService.start(dan.id, trip.id);
    const inProgress = await getRoute(trip.id, pia.token).expect(200);
    await tripsService.finish(dan.id, trip.id);
    const finished = await getRoute(trip.id, pia.token).expect(200);

    expect(started.startedAt).toBeInstanceOf(Date);
    expect(inProgress.body).toMatchObject({
      tripStatus: 'in_progress',
      startedAt: started.startedAt?.toISOString(),
      estimatedArrivalAt: new Date(
        (started.startedAt?.getTime() ?? 0) + 11 * MINUTE_MS,
      ).toISOString(),
    });
    expect(finished.body).toMatchObject({
      tripStatus: 'finished',
      estimatedArrivalAt: null,
    });
  });

  it('answers 404 for an unknown trip or a trip without a route', async () => {
    const { dan, trip } = await publishTrip();
    await dataSource.query('DELETE FROM routes WHERE trip_id = $1', [trip.id]);

    const noTrip = await getRoute(UNKNOWN_ID, dan.token).expect(404);
    const noRoute = await getRoute(trip.id, dan.token).expect(404);

    expect(noTrip.body).toMatchObject({ code: 'TRIP_NOT_FOUND' });
    expect(noRoute.body).toMatchObject({ code: 'ROUTE_NOT_FOUND' });
  });
});
