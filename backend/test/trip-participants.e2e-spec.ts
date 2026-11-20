import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

const EMAIL_PREFIX = 'participants-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};

interface Session {
  id: string;
  email: string;
  accessToken: string;
}

// Con quién se viaja: el perfil entre el conductor y cada pasajero con plaza
// (GET /api/trips/{id}/participants/{userId}) y los compañeros de viaje de un
// pasajero (GET /api/trips/{id}/participants)
describe('Trip participants API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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

  const get = (path: string, session: Session): request.Test =>
    request(app.getHttpServer())
      .get(`/api${path}`)
      .set('Authorization', `Bearer ${session.accessToken}`);

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
    return { id: body.user.id, email, accessToken: body.accessToken };
  }

  // Viaje de dan con pia y eva aceptadas y leo pendiente
  async function confirmedTrip() {
    const [dan, pia, eva, leo] = await Promise.all([
      sessionFor('dan', ['driver']),
      sessionFor('pia', ['passenger']),
      sessionFor('eva', ['passenger']),
      sessionFor('leo', ['passenger']),
    ]);
    await dataSource.query(
      `UPDATE users SET first_name = 'Pía', last_name = 'Ruiz', bio = 'Voy al campus cada día', phone = '+34600333444', phone_verified_at = now() WHERE id = $1`,
      [pia.id],
    );
    await app.get(UsersService).declareDriverLicense(dan.id);
    const vehicle = await app.get(VehiclesService).register(dan.id, {
      plate: '9702BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const { trip } = await app.get(TripsService).publish(dan.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      originName: 'Almería centro',
      destinationName: 'Campus UAL',
      departureAt: publishableDeparture(),
      offeredSeats: 3,
    });
    const requests = app.get(RequestsService);
    for (const passenger of [pia, eva]) {
      const { request: seat } = await requests.request(passenger.id, trip.id);
      await requests.accept(dan.id, seat.id);
    }
    await requests.request(leo.id, trip.id);
    return { tripId: trip.id, dan, pia, eva, leo };
  }

  it('shows the profile between the driver and each passenger with a seat, without the phone', async () => {
    const { tripId, dan, pia, eva, leo } = await confirmedTrip();
    const profile = (viewer: Session, target: Session) =>
      get(`/trips/${tripId}/participants/${target.id}`, viewer);

    const piaForDan = await profile(dan, pia).expect(200);
    expect(piaForDan.body).toEqual({
      '@type': 'ParticipantProfile',
      id: pia.id,
      name: 'Pía Ruiz',
      email: pia.email,
      avatarKey: null,
      bio: 'Voy al campus cada día',
      preferences: expect.any(Object) as object,
      ratings: expect.any(Object) as object,
    });
    expect(piaForDan.body).not.toHaveProperty('phone');
    const danForPia = await profile(pia, dan).expect(200);
    expect(danForPia.body).toMatchObject({ id: dan.id, email: dan.email });

    // Ni entre pasajeros, ni con la solicitud pendiente, ni con uno mismo
    for (const [viewer, target] of [
      [pia, eva],
      [leo, dan],
      [dan, leo],
      [dan, dan],
    ]) {
      const forbidden = await profile(viewer, target).expect(403);
      expect(forbidden.body).toMatchObject({
        code: 'PARTICIPANT_PROFILE_FORBIDDEN',
      });
    }

    // También en curso y después del viaje
    await setDepartureIn(dataSource, tripId, 5);
    const trips = app.get(TripsService);
    await trips.start(dan.id, tripId);
    await profile(dan, pia).expect(200);
    await trips.finish(dan.id, tripId);
    await profile(pia, dan).expect(200);
  });

  it('answers 404 for a trip that does not exist', async () => {
    const { dan, pia } = await confirmedTrip();
    const missingTrip = '00000000-0000-4000-8000-00000000dead';

    await get(`/trips/${missingTrip}/participants/${pia.id}`, dan).expect(404);
    await get(`/trips/${missingTrip}/participants`, pia).expect(404);
  });

  it('lists the co-passengers of a passenger with a seat, first name and avatar only', async () => {
    const { tripId, dan, pia, eva, leo } = await confirmedTrip();

    const forEva = await get(`/trips/${tripId}/participants`, eva).expect(200);
    expect(forEva.headers['x-total-count']).toBe('1');
    expect(forEva.headers['x-result-count']).toBe('1');
    expect(forEva.body).toEqual([
      { '@type': 'CoPassenger', id: pia.id, name: 'Pía', avatarKey: null },
    ]);

    // Ni el conductor ni quien tiene la solicitud pendiente
    for (const viewer of [dan, leo]) {
      const forbidden = await get(
        `/trips/${tripId}/participants`,
        viewer,
      ).expect(403);
      expect(forbidden.body).toMatchObject({
        code: 'PARTICIPANT_PROFILE_FORBIDDEN',
      });
    }
  });
});
