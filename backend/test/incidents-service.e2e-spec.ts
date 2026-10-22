import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { Incident } from '../src/modules/incidents/entities/incident.entity';
import { IncidentsService } from '../src/modules/incidents/incidents.service';
import { NotTripPassengerError } from '../src/modules/requests/errors/not-trip-passenger.error';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripNotFoundError } from '../src/modules/trips/errors/trip-not-found.error';
import { TripNotInProgressError } from '../src/modules/trips/errors/trip-not-in-progress.error';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';

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
    const testUsers = `SELECT id FROM users WHERE email LIKE '${EMAIL_PREFIX}%'`;
    const testTrips = `SELECT id FROM trips WHERE driver_id IN (${testUsers})`;
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (${testTrips})
         OR source_entity_id IN
           (SELECT id FROM requests WHERE trip_id IN (${testTrips}))
         OR source_entity_id IN
           (SELECT id FROM incidents WHERE trip_id IN (${testTrips}))`,
    );
    await dataSource.query(`DELETE FROM trips WHERE id IN (${testTrips})`);
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `${EMAIL_PREFIX}%`,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(
    name: string,
    profiles: ('driver' | 'passenger')[],
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
      departureAt: new Date(Date.now() + 10 * 60 * 1000),
      offeredSeats: 2,
    });
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

    const incident = await incidentsService.report(driverId, tripId, {
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

    const incident = await incidentsService.report(driverId, tripId, {
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

    const incident = await incidentsService.report(pia, tripId, {
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
});
