import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { IncidentsService } from '../src/modules/incidents/incidents.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// Reglas fijas de los avisos (RF-19) contra la base de datos real: a quién
// avisa cada cambio de una solicitud, un viaje o una incidencia. Los usuarios
// llevan el prefijo EMAIL_PREFIX; sus avisos caen en cascada con ellos y sus
// viajes
const EMAIL_PREFIX = 'notification-rules-test-';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};
const ALL = { offset: 0, limit: 100 };

describe('Notification rules (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let notificationsService: NotificationsService;
  let requestsService: RequestsService;
  let tripsService: TripsService;
  let usersService: UsersService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    notificationsService = app.get(NotificationsService);
    requestsService = app.get(RequestsService);
    tripsService = app.get(TripsService);
    usersService = app.get(UsersService);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(
    name: string,
    profiles: ('driver' | 'passenger' | 'admin')[] = ['passenger'],
  ): Promise<string> {
    const user = await usersService.createWithProfiles({
      name,
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      passwordHash: 'hash',
      profiles,
    });
    return user.id;
  }

  // Viaje de dan que sale en 10 minutos (se puede iniciar ya)
  async function publishTrip() {
    const driverId = await createUser('dan', ['driver']);
    await usersService.declareDriverLicense(driverId);
    const vehicle = await app.get(VehiclesService).register(driverId, {
      plate: '9924BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const { trip } = await tripsService.publish(driverId, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    // Sale en 10 minutos (publicado con la antelación mínima y movido)
    trip.departureAt = await setDepartureIn(dataSource, trip.id, 10);
    return { driverId, tripId: trip.id };
  }

  async function requestSeat(name: string, tripId: string) {
    const passengerId = await createUser(name);
    const { request } = await requestsService.request(passengerId, tripId);
    return { passengerId, requestId: request.id };
  }

  // Los avisos de un usuario, de los más recientes a los más antiguos
  async function noticesOf(userId: string) {
    const { items } = await notificationsService.listForUser(
      userId,
      undefined,
      ALL,
    );
    return items.map(({ type, tripId, requestId, incidentId }) => ({
      type,
      tripId,
      requestId,
      incidentId,
    }));
  }

  describe('fixed rules (RF-19)', () => {
    it('a new request notifies the driver, and accepting it the passenger', async () => {
      const { driverId, tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);

      await requestsService.accept(driverId, pia.requestId);

      expect(await noticesOf(driverId)).toEqual([
        {
          type: 'request_received',
          tripId,
          requestId: pia.requestId,
          incidentId: null,
        },
      ]);
      expect(await noticesOf(pia.passengerId)).toEqual([
        {
          type: 'request_accepted',
          tripId,
          requestId: pia.requestId,
          incidentId: null,
        },
      ]);
    });

    it('rejecting notifies the passenger; cancelling, the driver', async () => {
      const { driverId, tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      const leo = await requestSeat('leo', tripId);

      await requestsService.reject(driverId, pia.requestId);
      await requestsService.cancel(leo.passengerId, leo.requestId);

      expect(await noticesOf(pia.passengerId)).toMatchObject([
        { type: 'request_rejected' },
      ]);
      expect(await noticesOf(leo.passengerId)).toEqual([]);
      expect((await noticesOf(driverId)).map(({ type }) => type)).toEqual([
        'request_cancelled',
        'request_received',
        'request_received',
      ]);
    });

    it('cancelling the trip notifies its passengers, pending or accepted, not the driver', async () => {
      const { driverId, tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      const leo = await requestSeat('leo', tripId);
      await requestsService.accept(driverId, pia.requestId);

      await tripsService.cancel(driverId, tripId);

      expect(await noticesOf(pia.passengerId)).toMatchObject([
        { type: 'trip_cancelled', tripId, requestId: pia.requestId },
        { type: 'request_accepted' },
      ]);
      expect(await noticesOf(leo.passengerId)).toMatchObject([
        { type: 'trip_cancelled', tripId, requestId: leo.requestId },
      ]);
      expect((await noticesOf(driverId)).map(({ type }) => type)).toEqual([
        'request_received',
        'request_received',
      ]);
    });

    it('starting the trip notifies the pending passengers that they were rejected', async () => {
      const { driverId, tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      const leo = await requestSeat('leo', tripId);
      await requestsService.accept(driverId, pia.requestId);

      await tripsService.start(driverId, tripId);

      expect(await noticesOf(leo.passengerId)).toMatchObject([
        { type: 'request_rejected', requestId: leo.requestId },
      ]);
      expect(await noticesOf(pia.passengerId)).toMatchObject([
        { type: 'request_accepted' },
      ]);
    });

    it('an incident notifies the active administrators (not its reporter) and the driver that the passenger left', async () => {
      const { driverId, tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      await requestsService.accept(driverId, pia.requestId);
      await tripsService.start(driverId, tripId);
      const ada = await createUser('ada', ['admin']);
      // pia también es administradora: no se avisa a sí misma
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [pia.passengerId],
      );

      const { incident } = await app
        .get(IncidentsService)
        .report(pia.passengerId, tripId, {
          category: 'driver',
          description: 'I had to leave the car',
        });

      expect(await noticesOf(ada)).toEqual([
        {
          type: 'incident_reported',
          tripId,
          requestId: null,
          incidentId: incident.id,
        },
      ]);
      expect(await noticesOf(pia.passengerId)).toMatchObject([
        { type: 'request_accepted' },
      ]);
      expect(await noticesOf(driverId)).toMatchObject([
        { type: 'passenger_left', requestId: pia.requestId },
        { type: 'request_received' },
      ]);
    });

    it('the driver cancelling during the trip notifies the passengers', async () => {
      const { driverId, tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      await requestsService.accept(driverId, pia.requestId);
      await tripsService.start(driverId, tripId);

      await app.get(IncidentsService).report(driverId, tripId, {
        category: 'technical',
        description: 'The car broke down',
      });

      expect(await noticesOf(pia.passengerId)).toMatchObject([
        { type: 'trip_cancelled', requestId: pia.requestId },
        { type: 'request_accepted' },
      ]);
    });
  });
});
