import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { NotTripPassengerError } from '../requests/errors/not-trip-passenger.error';
import { RequestsService } from '../requests/requests.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripRoutesService } from '../trips/trip-routes.service';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import { VehiclesService } from '../users/vehicles.service';
import { toTripShareResource } from './dto/trip-share.resource';
import { TripPosition } from './entities/trip-position.entity';
import { TripShare } from './entities/trip-share.entity';
import { ShareNotAllowedError } from './errors/share-not-allowed.error';
import { ShareNotFoundError } from './errors/share-not-found.error';
import { hashShareToken } from './trip-share-rules';
import { TripSharesService } from './trip-shares.service';

const NOW = new Date('2026-11-14T08:00:00Z');
const TOKEN = 'a'.repeat(43);
const ROUTE = {
  durationMin: 20,
  geometry: {
    type: 'LineString',
    coordinates: [
      [-2.46, 36.84],
      [-2.4, 36.83],
    ],
  },
};

function buildTrip(changes: Partial<Trip> = {}): Trip {
  return Object.assign(new Trip(), {
    id: 'trip-1',
    vehicleId: 'vehicle-1',
    status: 'confirmed',
    destinationName: 'Parking P1',
    departureAt: new Date('2026-11-14T08:30:00Z'),
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date('2026-11-14T07:00:00Z'),
    ...changes,
  });
}

describe('TripSharesService', () => {
  let service: TripSharesService;
  const sharesRepository = { findOneBy: jest.fn() };
  const positionsRepository = { findOne: jest.fn() };
  const tripsService = { getById: jest.fn() };
  const tripStatus = { lockTrip: jest.fn() };
  const tripRoutes = { getForTrip: jest.fn() };
  const requestsService = {
    isAcceptedPassenger: jest.fn(),
    findLatestRequest: jest.fn(),
  };
  const vehiclesService = { getPlate: jest.fn() };
  const eventsService = { record: jest.fn() };
  let manager: { findOneBy: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((_, values: object) =>
        Object.assign(new TripShare(), {
          id: 'share-2',
          createdAt: NOW,
          ...values,
        }),
      ),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    const dataSource = {
      transaction: jest.fn(
        (callback: (em: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      ),
    };
    tripStatus.lockTrip.mockResolvedValue(buildTrip());
    requestsService.isAcceptedPassenger.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TripSharesService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(TripShare), useValue: sharesRepository },
        {
          provide: getRepositoryToken(TripPosition),
          useValue: positionsRepository,
        },
        { provide: TripsService, useValue: tripsService },
        { provide: TripStatusService, useValue: tripStatus },
        { provide: TripRoutesService, useValue: tripRoutes },
        { provide: RequestsService, useValue: requestsService },
        { provide: VehiclesService, useValue: vehiclesService },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();
    service = moduleRef.get(TripSharesService);
  });

  describe('create', () => {
    it('creates a link, keeps only its hash and records the event without it', async () => {
      const { share, token } = await service.create('passenger-1', 'trip-1');

      expect(token).toMatch(/^[\w-]{43}$/);
      expect(share.tokenHash).toBe(hashShareToken(token));
      expect(eventsService.record).toHaveBeenCalledWith(manager, {
        type: 'trip_share.created',
        sourceEntityId: 'share-2',
        payload: { tripId: 'trip-1', passengerId: 'passenger-1' },
      });
    });

    it('revokes the previous active link before creating another', async () => {
      const previous = Object.assign(new TripShare(), {
        id: 'share-1',
        tripId: 'trip-1',
        passengerId: 'passenger-1',
        revokedAt: null,
      });
      manager.findOneBy.mockResolvedValue(previous);

      await service.create('passenger-1', 'trip-1');

      expect(previous.revokedAt).toBeInstanceOf(Date);
      expect(eventsService.record).toHaveBeenNthCalledWith(1, manager, {
        type: 'trip_share.revoked',
        sourceEntityId: 'share-1',
        payload: { tripId: 'trip-1', passengerId: 'passenger-1' },
      });
      expect(eventsService.record).toHaveBeenCalledTimes(2);
    });

    it('refuses whoever is not an accepted passenger', async () => {
      requestsService.isAcceptedPassenger.mockResolvedValue(false);

      await expect(service.create('stranger', 'trip-1')).rejects.toThrow(
        NotTripPassengerError,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it.each(['published', 'finished', 'cancelled', 'expired'] as const)(
      'refuses a %s trip',
      async (status) => {
        tripStatus.lockTrip.mockResolvedValue(buildTrip({ status }));

        await expect(service.create('passenger-1', 'trip-1')).rejects.toThrow(
          ShareNotAllowedError,
        );
      },
    );
  });

  describe('revoke', () => {
    it('revokes the active link with its event', async () => {
      manager.findOneBy.mockResolvedValue(
        Object.assign(new TripShare(), { id: 'share-1', revokedAt: null }),
      );

      await service.revoke('passenger-1', 'trip-1');

      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
      expect(eventsService.record).toHaveBeenCalledTimes(1);
    });

    it('does nothing without an active link', async () => {
      await service.revoke('passenger-1', 'trip-1');

      expect(manager.save).not.toHaveBeenCalled();
      expect(eventsService.record).not.toHaveBeenCalled();
    });
  });

  describe('getByToken', () => {
    const share = Object.assign(new TripShare(), {
      id: 'share-1',
      tripId: 'trip-1',
      passengerId: 'passenger-1',
      revokedAt: null,
    });
    const acceptedRequest = {
      status: 'accepted',
      pickupName: 'Rambla',
      pickupAt: new Date('2026-11-14T08:40:00Z'),
      boardedAt: null,
    };

    function givenTrip(trip: Trip, request: object | null = acceptedRequest) {
      sharesRepository.findOneBy.mockResolvedValue(share);
      tripsService.getById.mockResolvedValue({
        trip,
        driverName: 'Lucía',
        vehicle: { brand: 'Seat', model: 'Ibiza', color: 'red' },
      });
      requestsService.findLatestRequest.mockResolvedValue(request);
      vehiclesService.getPlate.mockResolvedValue('1234ABC');
      tripRoutes.getForTrip.mockResolvedValue(ROUTE);
    }

    it('shows a confirmed trip with the plate but without the position or the route', async () => {
      givenTrip(buildTrip());

      const resource = toTripShareResource(
        await service.getByToken(TOKEN, NOW),
      );

      expect(sharesRepository.findOneBy).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: hashShareToken(TOKEN) }),
      );
      expect(resource).toMatchObject({
        '@type': 'TripShare',
        href: `/api/shares/${TOKEN}`,
        tripStatus: 'confirmed',
        passengerState: 'waiting',
        pickupName: 'Rambla',
        destinationName: 'Parking P1',
        estimatedArrivalAt: '2026-11-14T08:50:00.000Z',
        driver: { firstName: 'Lucía' },
        vehicle: { brand: 'Seat', plate: '1234ABC' },
        position: null,
        route: null,
      });
      expect(positionsRepository.findOne).not.toHaveBeenCalled();
    });

    it('shows the position and the route while in progress', async () => {
      givenTrip(buildTrip({ status: 'in_progress' }), {
        ...acceptedRequest,
        boardedAt: NOW,
      });
      positionsRepository.findOne.mockResolvedValue({
        position: { type: 'Point', coordinates: [-2.43, 36.83] },
        recordedAt: NOW,
        remainingMin: 7,
      });

      const resource = toTripShareResource(
        await service.getByToken(TOKEN, NOW),
      );

      expect(resource).toMatchObject({
        passengerState: 'on_board',
        estimatedArrivalAt: '2026-11-14T08:07:00.000Z',
        position: { remainingMin: 7 },
        route: ROUTE.geometry,
      });
    });

    it('shows a finished trip without the plate, the position or the arrival', async () => {
      givenTrip(
        buildTrip({ status: 'finished', finishedAt: new Date(NOW.getTime()) }),
      );

      const resource = toTripShareResource(
        await service.getByToken(TOKEN, NOW),
      );

      expect(resource).toMatchObject({
        passengerState: 'finished',
        estimatedArrivalAt: null,
        vehicle: { plate: null },
        position: null,
        route: null,
      });
      expect(vehiclesService.getPlate).not.toHaveBeenCalled();
    });

    it('rejects a malformed token without querying', async () => {
      await expect(service.getByToken('short', NOW)).rejects.toThrow(
        ShareNotFoundError,
      );
      expect(sharesRepository.findOneBy).not.toHaveBeenCalled();
    });

    it('rejects an unknown or revoked link', async () => {
      sharesRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getByToken(TOKEN, NOW)).rejects.toThrow(
        ShareNotFoundError,
      );
    });

    it('rejects the link of a passenger who no longer has the seat', async () => {
      givenTrip(buildTrip(), { ...acceptedRequest, status: 'cancelled' });

      await expect(service.getByToken(TOKEN, NOW)).rejects.toThrow(
        ShareNotFoundError,
      );
    });
  });
});
