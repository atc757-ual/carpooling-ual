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
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// Compartir el viaje en directo de punta a punta: el pasajero genera el
// enlace, alguien sin cuenta lo abre y el pasajero deja de compartir. OSRM se
// sustituye por uno falso (en el CI no hay OSRM). Los usuarios llevan el
// prefijo EMAIL_PREFIX y se borran con todo lo suyo (los enlaces caen en
// cascada con el viaje)
const EMAIL_PREFIX = 'trip-share-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};
const ON_THE_WAY: Point = { type: 'Point', coordinates: [-2.43, 36.833] };

interface Session {
  id: string;
  token: string;
}

interface ShareLinkBody {
  '@type': string;
  token: string;
  url: string;
  href: string;
}

describe('Trip share (e2e)', () => {
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
    await registerUser(app, { name, email, password: PASSWORD, profiles });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, token: body.accessToken };
  }

  // Viaje confirmado de dan con pia aceptada
  async function confirmedTrip() {
    const dan = await sessionFor('dan', ['driver']);
    await app.get(UsersService).declareDriverLicense(dan.id);
    const vehicle = await app.get(VehiclesService).register(dan.id, {
      plate: '4417FKD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const { trip } = await tripsService.publish(dan.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    await setDepartureIn(dataSource, trip.id, 20);
    const pia = await sessionFor('pia', ['passenger']);
    const requestsService = app.get(RequestsService);
    const { request: seat } = await requestsService.request(pia.id, trip.id);
    await requestsService.accept(dan.id, seat.id);
    return { dan, pia, tripId: trip.id };
  }

  async function startTrip(driver: Session, tripId: string): Promise<void> {
    await setDepartureIn(dataSource, tripId, 5);
    await tripsService.start(driver.id, tripId);
  }

  function share(tripId: string, session: Session) {
    return request(app.getHttpServer())
      .post(`/api/trips/${tripId}/share`)
      .set('Authorization', `Bearer ${session.token}`);
  }

  function follow(token: string) {
    return request(app.getHttpServer()).get(`/api/shares/${token}`);
  }

  it('shares a confirmed trip and opens it without an account', async () => {
    const { pia, tripId } = await confirmedTrip();

    const created = await share(tripId, pia).expect(201);
    const link = created.body as ShareLinkBody;

    expect(link['@type']).toBe('TripShareLink');
    expect(link.url).toBe(`/seguir/${link.token}`);
    expect(created.headers.location).toBe(link.href);
    const followed = await follow(link.token).expect(200);
    expect(followed.body).toMatchObject({
      '@type': 'TripShare',
      tripStatus: 'confirmed',
      passengerState: 'waiting',
      driver: { firstName: 'dan' },
      vehicle: { brand: 'Seat', model: 'Ibiza', plate: '4417FKD' },
      position: null,
      route: null,
    });
    expect(JSON.stringify(followed.body)).not.toContain('phone');
    const stored = await dataSource.query<{ token_hash: string }[]>(
      'SELECT token_hash FROM trip_shares WHERE trip_id = $1',
      [tripId],
    );
    expect(stored[0].token_hash).not.toBe(link.token);
    const events = await dataSource.getRepository(DomainEvent).findBy({
      type: 'trip_share.created',
    });
    expect(JSON.stringify(events)).not.toContain(link.token);
  });

  it('shows the position while in progress and hides the plate when finished', async () => {
    const { dan, pia, tripId } = await confirmedTrip();
    const { token } = (await share(tripId, pia).expect(201))
      .body as ShareLinkBody;
    await startTrip(dan, tripId);
    await request(app.getHttpServer())
      .post(`/api/trips/${tripId}/positions`)
      .set('Authorization', `Bearer ${dan.token}`)
      .send({ position: ON_THE_WAY })
      .expect(201);

    const live = await follow(token).expect(200);
    expect(live.body).toMatchObject({
      tripStatus: 'in_progress',
      position: { location: ON_THE_WAY, remainingMin: 5 },
      route: { type: 'LineString' },
    });

    await tripsService.finish(dan.id, tripId);
    const finished = await follow(token).expect(200);
    expect(finished.body).toMatchObject({
      passengerState: 'finished',
      vehicle: { plate: null },
      position: null,
      route: null,
    });
  });

  it('replaces the previous link and stops sharing', async () => {
    const { pia, tripId } = await confirmedTrip();
    const first = (await share(tripId, pia).expect(201)).body as ShareLinkBody;
    const second = (await share(tripId, pia).expect(201)).body as ShareLinkBody;

    const replaced = await follow(first.token).expect(404);
    expect(replaced.body).toMatchObject({ code: 'SHARE_NOT_FOUND' });
    await follow(second.token).expect(200);

    await request(app.getHttpServer())
      .delete(`/api/trips/${tripId}/share`)
      .set('Authorization', `Bearer ${pia.token}`)
      .expect(204);
    await follow(second.token).expect(404);
  });

  it('only lets an accepted passenger share', async () => {
    const { dan, tripId } = await confirmedTrip();
    const eve = await sessionFor('eve', ['passenger']);

    const refused = await share(tripId, eve).expect(403);
    expect(refused.body).toMatchObject({ code: 'NOT_TRIP_PASSENGER' });
    await share(tripId, dan).expect(403);
  });

  it('refuses to share a finished trip', async () => {
    const { dan, pia, tripId } = await confirmedTrip();
    await startTrip(dan, tripId);
    await tripsService.finish(dan.id, tripId);

    const refused = await share(tripId, pia).expect(409);
    expect(refused.body).toMatchObject({ code: 'SHARE_NOT_ALLOWED' });
  });

  it('answers 404 to an unknown link', async () => {
    await follow('x'.repeat(43)).expect(404);
  });
});
