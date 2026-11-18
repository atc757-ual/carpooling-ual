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
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// Cierre por pasajero (modo retorno): el conductor marca «Ha bajado» o el
// pasajero «He llegado», y cuando no queda nadie a bordo el viaje termina
// solo. OSRM se sustituye por uno falso. Los usuarios llevan el prefijo
// EMAIL_PREFIX y se borran con todo lo suyo
const EMAIL_PREFIX = 'drop-off-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };
const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};

interface Session {
  id: string;
  accessToken: string;
}

describe('Passenger drop-off (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OsrmClient)
      .useValue({
        route: (from: Point, to: Point): Promise<RoutePlan> =>
          Promise.resolve({
            distanceKm: 3.2,
            durationMin: 5,
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

  function act(session: Session, requestId: string, action: string) {
    return request(app.getHttpServer())
      .post(`/api/requests/${requestId}/${action}`)
      .set('Authorization', `Bearer ${session.accessToken}`);
  }

  async function tripStatus(tripId: string): Promise<string> {
    const [row] = await dataSource.query<{ status: string }[]>(
      'SELECT status FROM trips WHERE id = $1',
      [tripId],
    );
    return row.status;
  }

  async function board(driverId: string, requestId: string): Promise<void> {
    const [{ code }] = await dataSource.query<{ code: string }[]>(
      'SELECT board_code AS code FROM requests WHERE id = $1',
      [requestId],
    );
    await app.get(RequestsService).board(driverId, requestId, code);
  }

  // Viaje en curso de dan con pia y leo aceptadas (aún sin subir)
  async function tripInProgress(): Promise<{
    tripId: string;
    dan: Session;
    pia: Session;
    leo: Session;
    piaRequestId: string;
    leoRequestId: string;
  }> {
    // dan y pia tienen los dos perfiles: así se prueba que cada uno solo
    // marca lo suyo (no basta con tener el perfil)
    const [dan, pia, leo] = await Promise.all([
      sessionFor('dan', ['driver', 'passenger']),
      sessionFor('pia', ['passenger', 'driver']),
      sessionFor('leo', ['passenger']),
    ]);
    await app.get(UsersService).declareDriverLicense(dan.id);
    const vehicle = await app.get(VehiclesService).register(dan.id, {
      plate: '9928BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const trips = app.get(TripsService);
    const requests = app.get(RequestsService);
    const { trip } = await trips.publish(dan.id, {
      vehicleId: vehicle.id,
      origin: UAL_CAMPUS,
      destination: ALMERIA_CENTRE,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    await setDepartureIn(dataSource, trip.id, 20);
    const { request: piaSeat } = await requests.request(pia.id, trip.id);
    const { request: leoSeat } = await requests.request(leo.id, trip.id);
    await requests.accept(dan.id, piaSeat.id);
    await requests.accept(dan.id, leoSeat.id);
    await setDepartureIn(dataSource, trip.id, 5);
    await trips.start(dan.id, trip.id);
    return {
      tripId: trip.id,
      dan,
      pia,
      leo,
      piaRequestId: piaSeat.id,
      leoRequestId: leoSeat.id,
    };
  }

  it('closes each seat with «Ha bajado» or «He llegado» and then finishes the trip', async () => {
    const { tripId, dan, leo, piaRequestId, leoRequestId } =
      await tripInProgress();
    await board(dan.id, piaRequestId);
    await board(dan.id, leoRequestId);

    // El conductor deja a pia: su plaza se cierra y el viaje sigue
    const droppedOff = await act(dan, piaRequestId, 'drop-off').expect(200);
    expect(droppedOff.body).toMatchObject({
      id: piaRequestId,
      status: 'completed',
    });
    expect(await tripStatus(tripId)).toBe('in_progress');

    // leo marca «He llegado»: era la última a bordo y el viaje termina
    const arrived = await act(leo, leoRequestId, 'arrive').expect(200);
    expect(arrived.body).toMatchObject({
      id: leoRequestId,
      status: 'completed',
    });
    expect(await tripStatus(tripId)).toBe('finished');
  }, 30_000);

  it('refuses to close a seat that has not boarded, or someone else’s', async () => {
    const { tripId, dan, pia, leo, piaRequestId } = await tripInProgress();

    const notBoarded = await act(pia, piaRequestId, 'arrive').expect(409);
    expect(notBoarded.body).toMatchObject({ code: 'PASSENGER_NOT_BOARDED' });

    await board(dan.id, piaRequestId);
    // Cada uno marca solo lo suyo: pia no hace de conductor ni dan de pasajero
    const notDriver = await act(pia, piaRequestId, 'drop-off').expect(403);
    expect(notDriver.body).toMatchObject({ code: 'NOT_TRIP_DRIVER' });
    const notPassenger = await act(dan, piaRequestId, 'arrive').expect(403);
    expect(notPassenger.body).toMatchObject({ code: 'NOT_REQUEST_PASSENGER' });
    // A otro pasajero ni siquiera se le dice que la plaza existe
    const someoneElse = await act(leo, piaRequestId, 'arrive').expect(404);
    expect(someoneElse.body).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
    expect(await tripStatus(tripId)).toBe('in_progress');
  }, 30_000);
});
