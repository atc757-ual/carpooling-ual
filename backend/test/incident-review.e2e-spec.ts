import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { IncidentAlreadyReviewedError } from '../src/modules/incidents/errors/incident-already-reviewed.error';
import { IncidentInvolvedAdminError } from '../src/modules/incidents/errors/incident-involved-admin.error';
import { IncidentNotFoundError } from '../src/modules/incidents/errors/incident-not-found.error';
import { IncidentReviewTakenError } from '../src/modules/incidents/errors/incident-review-taken.error';
import { InvalidIncidentTransitionError } from '../src/modules/incidents/errors/invalid-incident-transition.error';
import { IncidentReviewService } from '../src/modules/incidents/incident-review.service';
import { IncidentsService } from '../src/modules/incidents/incidents.service';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// La revisión de una incidencia contra la base de datos real (CU-12):
// registrada → en revisión → atendida. Los usuarios llevan el prefijo
// EMAIL_PREFIX y se borran en afterEach con todo lo suyo
const EMAIL_PREFIX = 'incident-review-test-';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};
const RESOLUTION = 'The driver was contacted and the car repaired';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('Incident review (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let review: IncidentReviewService;
  let usersService: UsersService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    review = app.get(IncidentReviewService);
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
      firstName: name,
      lastName: 'Prueba',
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      passwordHash: 'hash',
      profiles,
    });
    return user.id;
  }

  type Profile = 'driver' | 'passenger' | 'admin';

  // Una incidencia registrada por el conductor (dan) en un viaje en curso con
  // una pasajera aceptada (pia) y, si se indica, alguien que solo pidió plaza
  // (rex, sin aceptar). Los perfiles permiten hacer administrador a cualquiera
  async function reportedIncident(
    profiles: { dan?: Profile[]; pia?: Profile[]; rex?: Profile[] } = {},
  ): Promise<string> {
    const driverId = await createUser('dan', profiles.dan ?? ['driver']);
    await usersService.declareDriverLicense(driverId);
    const vehicle = await app.get(VehiclesService).register(driverId, {
      plate: '9931BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const trips = app.get(TripsService);
    const { trip } = await trips.publish(driverId, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    await setDepartureIn(dataSource, trip.id, 10);
    const requests = app.get(RequestsService);
    const pia = await createUser('pia', profiles.pia ?? ['passenger']);
    const { request } = await requests.request(pia, trip.id);
    await requests.accept(driverId, request.id);
    if (profiles.rex) {
      const rex = await createUser('rex', profiles.rex);
      await requests.request(rex, trip.id);
    }
    await trips.start(driverId, trip.id);
    const { incident } = await app
      .get(IncidentsService)
      .report(driverId, trip.id, {
        category: 'technical',
        description: 'The car broke down on the way to the campus',
      });
    return incident.id;
  }

  function eventTypesOf(incidentId: string): Promise<string[]> {
    return dataSource.manager
      .find(DomainEvent, {
        where: { sourceEntityId: incidentId },
        order: { sequence: 'ASC' },
      })
      .then((events) => events.map(({ type }) => type));
  }

  it('goes from registered to in review to resolved, with who, when and its events', async () => {
    const id = await reportedIncident();
    const ada = await createUser('ada', ['admin']);

    const started = await review.start(ada, id);
    expect(started.incident).toMatchObject({
      status: 'in_review',
      reviewStartedBy: ada,
    });
    expect(started.reviewStartedByName).toBe('ada Prueba');

    const resolved = await review.resolve(ada, id, RESOLUTION);
    const { incident } = resolved;
    expect(incident).toMatchObject({
      status: 'reviewed',
      reviewedBy: ada,
      resolution: RESOLUTION,
    });
    expect(incident.reviewedAt).toBeInstanceOf(Date);
    // Quién la atendió, y el inicio de su revisión se conserva
    expect(resolved.reviewedByName).toBe('ada Prueba');
    expect(incident.reviewStartedAt).toBeInstanceOf(Date);
    expect(await eventTypesOf(id)).toEqual([
      'incident.reported',
      'incident.review_started',
      'incident.reviewed',
    ]);
  });

  it('leaves the review: back to registered, so that another admin can take it', async () => {
    const id = await reportedIncident();
    const ada = await createUser('ada', ['admin']);
    const bob = await createUser('bob', ['admin']);
    await review.start(ada, id);

    const released = await review.release(ada, id);
    expect(released.incident).toMatchObject({
      status: 'open',
      reviewStartedBy: null,
      reviewStartedAt: null,
    });

    const taken = await review.start(bob, id);
    expect(taken.incident.reviewStartedBy).toBe(bob);
    expect(await eventTypesOf(id)).toContain('incident.review_released');
  });

  it('only the admin who reviews it can leave or resolve it', async () => {
    const id = await reportedIncident();
    const ada = await createUser('ada', ['admin']);
    const bob = await createUser('bob', ['admin']);
    await review.start(ada, id);

    await expect(review.start(bob, id)).rejects.toBeInstanceOf(
      IncidentReviewTakenError,
    );
    await expect(review.release(bob, id)).rejects.toBeInstanceOf(
      IncidentReviewTakenError,
    );
    await expect(review.resolve(bob, id, RESOLUTION)).rejects.toBeInstanceOf(
      IncidentReviewTakenError,
    );
  });

  it('cannot resolve or leave a registered incident without starting the review', async () => {
    const id = await reportedIncident();
    const ada = await createUser('ada', ['admin']);

    await expect(review.resolve(ada, id, RESOLUTION)).rejects.toBeInstanceOf(
      InvalidIncidentTransitionError,
    );
    await expect(review.release(ada, id)).rejects.toBeInstanceOf(
      InvalidIncidentTransitionError,
    );
  });

  it('a resolved incident is final, even when two requests arrive at once', async () => {
    const id = await reportedIncident();
    const ada = await createUser('ada', ['admin']);
    await review.start(ada, id);

    const results = await Promise.allSettled([
      review.resolve(ada, id, RESOLUTION),
      review.resolve(ada, id, RESOLUTION),
    ]);

    const rejected = results.filter(({ status }) => status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      IncidentAlreadyReviewedError,
    );
    await expect(review.start(ada, id)).rejects.toBeInstanceOf(
      IncidentAlreadyReviewedError,
    );
  });

  it('an admin involved in the trip cannot manage it: who reported it, the passengers and who requested a seat', async () => {
    const id = await reportedIncident({
      dan: ['driver', 'admin'],
      pia: ['passenger', 'admin'],
      rex: ['passenger', 'admin'],
    });
    const adminIds = await Promise.all(
      ['dan', 'pia', 'rex'].map(async (name) => {
        const user = await usersService.findByEmail(
          `${EMAIL_PREFIX}${name}@ual.es`,
        );
        return user?.id ?? '';
      }),
    );

    for (const adminId of adminIds) {
      await expect(review.start(adminId, id)).rejects.toBeInstanceOf(
        IncidentInvolvedAdminError,
      );
    }
    const view = await app.get(IncidentsService).get(adminIds[2], true, id);
    expect(view.isViewerInvolved).toBe(true);
  });

  it('marks the incident as not involved for an outside admin', async () => {
    const id = await reportedIncident();
    const ada = await createUser('ada', ['admin']);

    const view = await app.get(IncidentsService).get(ada, true, id);
    expect(view.isViewerInvolved).toBe(false);
  });

  it('answers INCIDENT_NOT_FOUND for an unknown incident', async () => {
    const ada = await createUser('ada', ['admin']);

    await expect(review.start(ada, UNKNOWN_ID)).rejects.toBeInstanceOf(
      IncidentNotFoundError,
    );
  });
});
