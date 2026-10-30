import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { Incident } from '../src/modules/incidents/entities/incident.entity';
import { IncidentAlreadyReviewedError } from '../src/modules/incidents/errors/incident-already-reviewed.error';
import { IncidentNotFoundError } from '../src/modules/incidents/errors/incident-not-found.error';
import { IncidentsService } from '../src/modules/incidents/incidents.service';
import { NotTripPassengerError } from '../src/modules/requests/errors/not-trip-passenger.error';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripNotFoundError } from '../src/modules/trips/errors/trip-not-found.error';
import { TripNotInProgressError } from '../src/modules/trips/errors/trip-not-in-progress.error';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// IncidentsService contra la base de datos real (RF-23). Los usuarios llevan
// el prefijo EMAIL_PREFIX; en afterEach se borran los eventos de sus viajes,
// solicitudes e incidencias, y después los viajes (solicitudes e incidencias
// caen en cascada) y los usuarios
const EMAIL_PREFIX = 'incidents-test-';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};
const DESCRIPTION = 'The car broke down on the way to the campus';

describe('IncidentsService (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let incidentsService: IncidentsService;
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
    incidentsService = app.get(IncidentsService);
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
    profiles: ('driver' | 'passenger' | 'admin')[],
  ): Promise<string> {
    const user = await usersService.createWithProfiles({
      name,
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      passwordHash: 'hash',
      profiles,
    });
    return user.id;
  }

  // Viaje que sale en 10 minutos con una pasajera aceptada (pia). Si started,
  // además está en curso
  async function tripWithPassenger(started = true) {
    const driverId = await createUser('dan', ['driver']);
    await usersService.declareDriverLicense(driverId);
    const vehicle = await app
      .get(VehiclesService)
      .register(driverId, { plate: '9921BCD', capacity: 4 });
    const { trip } = await tripsService.publish(driverId, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    // Sale en 10 minutos (publicado con la antelación mínima y movido)
    trip.departureAt = await setDepartureIn(dataSource, trip.id, 10);
    const pia = await createUser('pia', ['passenger']);
    const { request } = await requestsService.request(pia, trip.id);
    await requestsService.accept(driverId, request.id);
    if (started) {
      await tripsService.start(driverId, trip.id);
    }
    return { driverId, tripId: trip.id, pia, requestId: request.id };
  }

  function incidentsOf(tripId: string): Promise<Incident[]> {
    return dataSource.manager.findBy(Incident, { tripId });
  }

  it('the driver reports: the trip is cancelled and the incident saved', async () => {
    const { driverId, tripId, pia } = await tripWithPassenger();

    const { incident } = await incidentsService.report(driverId, tripId, {
      category: 'technical',
      description: DESCRIPTION,
    });

    expect(incident).toMatchObject({
      tripId,
      requestId: null,
      reporterId: driverId,
      category: 'technical',
      description: DESCRIPTION,
    });
    const { trip } = await tripsService.getById(tripId);
    expect(trip.status).toBe('cancelled');
    expect(await usersService.getPassengerPriority(pia)).toBe(true);
  });

  it('records incident.reported without the free-text description', async () => {
    const { driverId, tripId } = await tripWithPassenger();

    const { incident } = await incidentsService.report(driverId, tripId, {
      category: 'technical',
      description: DESCRIPTION,
    });

    const [event] = await dataSource.manager.findBy(DomainEvent, {
      sourceEntityId: incident.id,
    });
    expect(event).toMatchObject({
      type: 'incident.reported',
      payload: {
        tripId,
        reporterRole: 'driver',
        category: 'technical',
      },
    });
    expect(JSON.stringify(event.payload)).not.toContain(DESCRIPTION);
  });

  it('a passenger reports: only their request is cancelled, the trip goes on', async () => {
    const { tripId, pia, requestId } = await tripWithPassenger();

    const { incident } = await incidentsService.report(pia, tripId, {
      category: 'driver',
      description: 'The driver was driving dangerously',
    });

    expect(incident).toMatchObject({ requestId, reporterId: pia });
    const { trip } = await tripsService.getById(tripId);
    expect(trip).toMatchObject({ status: 'in_progress', availableSeats: 2 });
    expect(await usersService.getPassengerPriority(pia)).toBe(false);
  });

  it('rejects someone who is not on the trip, and saves nothing', async () => {
    const { tripId } = await tripWithPassenger();
    const stranger = await createUser('sam', ['passenger']);

    await expect(
      incidentsService.report(stranger, tripId, {
        category: 'other',
        description: DESCRIPTION,
      }),
    ).rejects.toBeInstanceOf(NotTripPassengerError);
    expect(await incidentsOf(tripId)).toEqual([]);
  });

  it('only applies to trips in progress, and saves nothing otherwise', async () => {
    const { driverId, tripId } = await tripWithPassenger(false);

    await expect(
      incidentsService.report(driverId, tripId, {
        category: 'technical',
        description: DESCRIPTION,
      }),
    ).rejects.toBeInstanceOf(TripNotInProgressError);
    expect(await incidentsOf(tripId)).toEqual([]);
    const { trip } = await tripsService.getById(tripId);
    expect(trip.status).toBe('confirmed');
  });

  it('answers TRIP_NOT_FOUND for an unknown trip', async () => {
    const pia = await createUser('pia', ['passenger']);

    await expect(
      incidentsService.report(pia, '00000000-0000-4000-8000-000000000000', {
        category: 'other',
        description: DESCRIPTION,
      }),
    ).rejects.toBeInstanceOf(TripNotFoundError);
  });

  // CU-12: revisión por el administrador y quién ve cada incidencia
  describe('review and visibility (CU-12)', () => {
    const ALL = { offset: 0, limit: 100 };
    const RESOLUTION = 'The driver was contacted and the car repaired';

    // Una incidencia registrada por el conductor (dan) en un viaje en curso con
    // una pasajera aceptada (pia)
    async function driverIncident() {
      const driverTrip = await tripWithPassenger();
      const { incident: byDriver } = await incidentsService.report(
        driverTrip.driverId,
        driverTrip.tripId,
        { category: 'technical', description: DESCRIPTION },
      );
      return { byDriver, driverTrip };
    }

    it('shows an incident to whoever reported it, with their name and role', async () => {
      const { byDriver, driverTrip } = await driverIncident();

      const view = await incidentsService.get(
        driverTrip.driverId,
        false,
        byDriver.id,
      );

      expect(view).toMatchObject({
        reporterName: 'dan',
        reporterRole: 'driver',
      });
    });

    it('hides it from anyone else (even people on the trip), but not from an admin', async () => {
      const { byDriver, driverTrip } = await driverIncident();
      const admin = await createUser('ada', ['admin']);

      await expect(
        incidentsService.get(driverTrip.pia, false, byDriver.id),
      ).rejects.toBeInstanceOf(IncidentNotFoundError);
      await expect(
        incidentsService.get(admin, true, byDriver.id),
      ).resolves.toMatchObject({ incident: { id: byDriver.id } });
    });

    it('lists the incidents of the reporter and, for the admin, by status', async () => {
      const { byDriver, driverTrip } = await driverIncident();

      const mine = await incidentsService.listForReporter(
        driverTrip.driverId,
        ALL,
      );
      const open = await incidentsService.list('open', ALL);

      expect(mine.items.map(({ incident }) => incident.id)).toEqual([
        byDriver.id,
      ]);
      expect(open.items.map(({ incident }) => incident.id)).toContain(
        byDriver.id,
      );
    });

    it('reviews an incident: reviewed, with who, when, the resolution and its event', async () => {
      const { byDriver } = await driverIncident();
      const admin = await createUser('ada', ['admin']);

      const { incident } = await incidentsService.review(
        admin,
        byDriver.id,
        RESOLUTION,
      );

      expect(incident).toMatchObject({
        status: 'reviewed',
        reviewedBy: admin,
        resolution: RESOLUTION,
      });
      expect(incident.reviewedAt).toBeInstanceOf(Date);
      const events = await dataSource.manager.findBy(DomainEvent, {
        sourceEntityId: byDriver.id,
      });
      const reviewed = events.find(({ type }) => type === 'incident.reviewed');
      expect(reviewed?.payload).toMatchObject({ status: 'reviewed' });
      expect(JSON.stringify(reviewed?.payload)).not.toContain(RESOLUTION);
      const open = await incidentsService.list('open', ALL);
      expect(open.items.map(({ incident: i }) => i.id)).not.toContain(
        byDriver.id,
      );
    });

    it('does not review an incident twice, not even at the same time', async () => {
      const { byDriver } = await driverIncident();
      const admin = await createUser('ada', ['admin']);

      const results = await Promise.allSettled([
        incidentsService.review(admin, byDriver.id, RESOLUTION),
        incidentsService.review(admin, byDriver.id, RESOLUTION),
      ]);

      const rejected = results.filter(({ status }) => status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        IncidentAlreadyReviewedError,
      );
    });

    it('answers INCIDENT_NOT_FOUND when reviewing an unknown incident', async () => {
      const admin = await createUser('ada', ['admin']);

      await expect(
        incidentsService.review(
          admin,
          '00000000-0000-4000-8000-000000000000',
          RESOLUTION,
        ),
      ).rejects.toBeInstanceOf(IncidentNotFoundError);
    });
  });
});
