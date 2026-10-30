import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { NotificationNotFoundError } from '../src/modules/notifications/errors/notification-not-found.error';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// NotificationsService contra la base de datos real (RF-19): crear avisos en
// la transacción del cambio, listarlos y marcarlos como leídos. Las reglas de
// a quién se avisa están en notification-rules.e2e-spec.ts. Los usuarios
// llevan el prefijo EMAIL_PREFIX; sus avisos caen en cascada con ellos y sus
// viajes
const EMAIL_PREFIX = 'notifications-test-';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};
const ALL = { offset: 0, limit: 100 };

describe('NotificationsService (e2e)', () => {
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
    const vehicle = await app
      .get(VehiclesService)
      .register(driverId, { plate: '9922BCD', capacity: 4 });
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

  describe('reading', () => {
    // Una pasajera con dos avisos: request_accepted y, el más reciente,
    // trip_cancelled
    async function passengerWithTwoNotices() {
      const { driverId, tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      await requestsService.accept(driverId, pia.requestId);
      await tripsService.cancel(driverId, tripId);
      return pia.passengerId;
    }

    it('marks one as read, keeping the date of the first reading, and filters by isRead', async () => {
      const pia = await passengerWithTwoNotices();
      const [latest] = (await notificationsService.listForUser(pia, false, ALL))
        .items;

      const read = await notificationsService.markRead(pia, latest.id);
      const again = await notificationsService.markRead(pia, latest.id);

      expect(read.readAt).toBeInstanceOf(Date);
      expect(again.readAt).toEqual(read.readAt);
      const unread = await notificationsService.listForUser(pia, false, ALL);
      const alreadyRead = await notificationsService.listForUser(
        pia,
        true,
        ALL,
      );
      expect(unread.total).toBe(1);
      expect(alreadyRead.items.map(({ id }) => id)).toEqual([latest.id]);
    });

    it('marks all as read and paginates', async () => {
      const pia = await passengerWithTwoNotices();

      await notificationsService.markAllRead(pia);

      const unread = await notificationsService.listForUser(pia, false, ALL);
      const firstPage = await notificationsService.listForUser(pia, true, {
        offset: 0,
        limit: 1,
      });
      expect(unread.total).toBe(0);
      expect(firstPage).toMatchObject({
        total: 2,
        items: [{ type: 'trip_cancelled' }],
      });
    });

    it('a notification of someone else does not exist for you', async () => {
      const pia = await passengerWithTwoNotices();
      const leo = await createUser('leo');
      const [notice] = (await notificationsService.listForUser(pia, false, ALL))
        .items;

      await expect(
        notificationsService.markRead(leo, notice.id),
      ).rejects.toBeInstanceOf(NotificationNotFoundError);
    });

    it('is created in the transaction of the change: if it fails, there is no notification', async () => {
      const { tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      const content = {
        type: 'request_accepted' as const,
        tripId,
        requestId: pia.requestId,
      };

      await expect(
        dataSource.transaction(async (manager) => {
          await notificationsService.notify(
            manager,
            [pia.passengerId],
            content,
          );
          throw new Error('the change failed');
        }),
      ).rejects.toThrow('the change failed');

      expect(await noticesOf(pia.passengerId)).toEqual([]);
    });

    it('notifies each recipient only once, and nobody if there are none', async () => {
      const { tripId } = await publishTrip();
      const pia = await requestSeat('pia', tripId);
      const content = {
        type: 'request_accepted' as const,
        tripId,
        requestId: pia.requestId,
      };

      await notificationsService.notify(
        dataSource.manager,
        [pia.passengerId, pia.passengerId],
        content,
      );
      await notificationsService.notify(dataSource.manager, [], content);

      expect(await noticesOf(pia.passengerId)).toHaveLength(1);
    });
  });
});
