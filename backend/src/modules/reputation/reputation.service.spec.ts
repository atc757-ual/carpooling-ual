import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { RequestsService } from '../requests/requests.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import { EMPTY_TRAVEL_PREFERENCES } from '../users/travel-preferences';
import { UsersService } from '../users/users.service';
import { Review, REVIEW_WINDOW_MS } from './entities/review.entity';
import { ReviewAlreadyExistsError } from './errors/review-already-exists.error';
import { ReviewNotAllowedError } from './errors/review-not-allowed.error';
import { ReviewWindowClosedError } from './errors/review-window-closed.error';
import { ReputationService } from './reputation.service';

describe('ReputationService', () => {
  let service: ReputationService;
  const reviewsRepository = {
    findAndCount: jest.fn(),
    find: jest.fn(),
  };
  const tripsService = {
    getByIds: jest.fn(),
    findFinishedSinceForParticipant: jest.fn(),
  };
  const tripStatus = {
    lockTrip: jest.fn(),
  };
  const requestsService = {
    isAcceptedPassenger: jest.fn(),
    acceptedTripIdsOfPassenger: jest.fn(),
    acceptedPassengersByTrip: jest.fn(),
  };
  const usersService = {
    onBeforeUserSummary: jest.fn(),
    setRoleRating: jest.fn(),
    getPublicProfiles: jest.fn(),
  };
  const eventsService = {
    record: jest.fn(),
  };

  let manager: {
    existsBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    query: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = {
      existsBy: jest.fn().mockResolvedValue(false),
      create: jest.fn((_, values: object) =>
        Object.assign(new Review(), {
          id: 'review-1',
          createdAt: new Date('2026-10-31T10:00:00Z'),
          ...values,
        }),
      ),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
    };

    const dataSource = {
      transaction: jest.fn(
        (callback: (em: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      ),
    };

    usersService.getPublicProfiles.mockResolvedValue(
      new Map([
        [
          'driver-1',
          {
            id: 'driver-1',
            name: 'Lucía',
            avatarKey: 'sun',
            preferences: EMPTY_TRAVEL_PREFERENCES,
          },
        ],
        [
          'passenger-1',
          {
            id: 'passenger-1',
            name: 'Mario',
            avatarKey: 'headphones',
            preferences: EMPTY_TRAVEL_PREFERENCES,
          },
        ],
      ]),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReputationService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(Review), useValue: reviewsRepository },
        { provide: TripsService, useValue: tripsService },
        { provide: TripStatusService, useValue: tripStatus },
        { provide: RequestsService, useValue: requestsService },
        { provide: UsersService, useValue: usersService },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = moduleRef.get(ReputationService);
  });

  function finishedTrip(overrides: Partial<Trip> = {}): Trip {
    return Object.assign(new Trip(), {
      id: 'trip-1',
      driverId: 'driver-1',
      originName: 'Roquetas de Mar',
      destinationName: 'Campus UAL',
      departureAt: new Date('2026-10-31T08:00:00Z'),
      status: 'finished',
      finishedAt: new Date(Date.now() - 60_000),
      updatedAt: new Date(Date.now() - 60_000),
      ...overrides,
    });
  }

  describe('createReview', () => {
    it('keeps the first review unpublished and records review.created without the comment', async () => {
      tripStatus.lockTrip.mockResolvedValue(finishedTrip());
      requestsService.isAcceptedPassenger.mockResolvedValue(true);

      const view = await service.createReview('passenger-1', 'trip-1', {
        targetId: 'driver-1',
        rating: 5,
        comment: 'Excelente viaje.',
      });

      expect(view.review.publishedAt).toBeNull();
      expect(view.review.targetRole).toBe('driver');
      expect(eventsService.record).toHaveBeenCalledTimes(1);
      expect(eventsService.record).toHaveBeenCalledWith(expect.anything(), {
        type: 'review.created',
        sourceEntityId: 'review-1',
        payload: {
          tripId: 'trip-1',
          authorId: 'passenger-1',
          targetId: 'driver-1',
          targetRole: 'driver',
          rating: 5,
        },
      });
    });

    it('publishes both reviews and updates role averages when the counterpart review already exists', async () => {
      tripStatus.lockTrip.mockResolvedValue(finishedTrip());
      requestsService.isAcceptedPassenger.mockResolvedValue(true);
      const counterpart = Object.assign(new Review(), {
        id: 'review-0',
        tripId: 'trip-1',
        authorId: 'driver-1',
        targetId: 'passenger-1',
        targetRole: 'passenger',
        rating: 4,
        comment: null,
        createdAt: new Date('2026-10-31T09:50:00Z'),
        publishedAt: null,
      });
      manager.findOne.mockResolvedValue(counterpart);
      manager.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 3, average: '4.33' }])
        .mockResolvedValueOnce([{ count: 1, average: '5.00' }]);

      const view = await service.createReview('passenger-1', 'trip-1', {
        targetId: 'driver-1',
        rating: 5,
      });

      expect(view.review.publishedAt).toBeInstanceOf(Date);
      expect(counterpart.publishedAt).toBeInstanceOf(Date);
      expect(usersService.setRoleRating).toHaveBeenCalledWith(
        expect.anything(),
        'passenger-1',
        'passenger',
        { averageRating: 4.33, ratingCount: 3 },
      );
      expect(usersService.setRoleRating).toHaveBeenCalledWith(
        expect.anything(),
        'driver-1',
        'driver',
        { averageRating: 5, ratingCount: 1 },
      );
      expect(eventsService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'review.published',
          sourceEntityId: 'review-0',
        }),
      );
      expect(eventsService.record).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'review.published',
          sourceEntityId: 'review-1',
        }),
      );
    });

    it('rejects reviewing oneself, a non-participant or an unfinished trip (403 REVIEW_NOT_ALLOWED)', async () => {
      tripStatus.lockTrip.mockResolvedValue(finishedTrip());

      await expect(
        service.createReview('driver-1', 'trip-1', {
          targetId: 'driver-1',
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ReviewNotAllowedError);

      requestsService.isAcceptedPassenger.mockResolvedValue(false);
      await expect(
        service.createReview('stranger', 'trip-1', {
          targetId: 'driver-1',
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ReviewNotAllowedError);

      requestsService.isAcceptedPassenger.mockResolvedValue(true);
      tripStatus.lockTrip.mockResolvedValue(
        finishedTrip({ status: 'in_progress' }),
      );
      await expect(
        service.createReview('passenger-1', 'trip-1', {
          targetId: 'driver-1',
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ReviewNotAllowedError);
    });

    it('rejects a duplicate review (409 REVIEW_ALREADY_EXISTS)', async () => {
      tripStatus.lockTrip.mockResolvedValue(finishedTrip());
      requestsService.isAcceptedPassenger.mockResolvedValue(true);
      manager.existsBy.mockResolvedValue(true);

      await expect(
        service.createReview('passenger-1', 'trip-1', {
          targetId: 'driver-1',
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ReviewAlreadyExistsError);
    });

    it('rejects a review after the 7-day window (409 REVIEW_WINDOW_CLOSED)', async () => {
      tripStatus.lockTrip.mockResolvedValue(
        finishedTrip({
          finishedAt: new Date(Date.now() - REVIEW_WINDOW_MS - 1000),
        }),
      );
      requestsService.isAcceptedPassenger.mockResolvedValue(true);

      await expect(
        service.createReview('passenger-1', 'trip-1', {
          targetId: 'driver-1',
          rating: 5,
        }),
      ).rejects.toBeInstanceOf(ReviewWindowClosedError);
    });
  });

  describe('listPendingForUser', () => {
    it('lists finished trips within 7 days with the remaining targets to review', async () => {
      const trip = finishedTrip();
      requestsService.acceptedTripIdsOfPassenger.mockResolvedValue([]);
      tripsService.findFinishedSinceForParticipant.mockResolvedValue([trip]);
      requestsService.acceptedPassengersByTrip.mockResolvedValue(
        new Map([['trip-1', ['passenger-1']]]),
      );
      reviewsRepository.find.mockResolvedValue([]);

      const pending = await service.listPendingForUser('driver-1');

      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        myRole: 'driver',
        targets: [
          {
            id: 'passenger-1',
            name: 'Mario',
            avatarKey: 'headphones',
            role: 'passenger',
          },
        ],
      });
    });
  });
});
