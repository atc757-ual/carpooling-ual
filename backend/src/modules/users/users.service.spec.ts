import { TravelPreferencesService } from '../catalogs/travel-preferences.service';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindManyOptions } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { AvatarsService } from './avatars.service';
import { ConsentsService } from './consents.service';
import { User } from './entities/user.entity';
import { AccountHasActiveTripsError } from './errors/account-has-active-trips.error';
import { UserNotFoundError } from './errors/user-not-found.error';
import { EMPTY_TRAVEL_PREFERENCES } from './travel-preferences';
import { UsersService } from './users.service';
import { VehiclesService } from './vehicles.service';

// El manager del DataSource: las comprobaciones previas a la baja solo leen
const DATA_SOURCE_MANAGER = {
  name: 'data-source-manager',
} as unknown as EntityManager;

// Tests unitarios de la lógica que no depende de la base de datos. Lo que sí
// depende de ella (transacción, UNIQUE, citext) se prueba en
// test/users-service.e2e-spec.ts contra PostgreSQL
describe('UsersService', () => {
  let usersService: UsersService;
  const usersRepository = { findOne: jest.fn(), find: jest.fn() };

  beforeEach(async () => {
    usersRepository.findOne.mockReset();
    usersRepository.find.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DataSource, useValue: { manager: DATA_SOURCE_MANAGER } },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: VehiclesService, useValue: {} },
        { provide: AvatarsService, useValue: {} },
        {
          provide: TravelPreferencesService,
          useValue: { isOffered: jest.fn().mockResolvedValue(true) },
        },
        { provide: ConsentsService, useValue: {} },
        { provide: EventsService, useValue: {} },
      ],
    }).compile();

    usersService = moduleRef.get(UsersService);
  });

  function userWith(profiles: Partial<User>): User {
    return Object.assign(new User(), profiles);
  }

  describe('assertCanDeactivate', () => {
    it('runs every registered check, in order, with the shared manager', async () => {
      const calls: string[] = [];
      usersService.onDeactivationCheck((manager, userId) => {
        calls.push(
          `first:${userId}:${String(manager === DATA_SOURCE_MANAGER)}`,
        );
        return Promise.resolve();
      });
      usersService.onDeactivationCheck((_manager, userId) => {
        calls.push(`second:${userId}`);
        return Promise.resolve();
      });

      await usersService.assertCanDeactivate('user-1');

      expect(calls).toEqual(['first:user-1:true', 'second:user-1']);
    });

    it('stops with the error of the first failing check', async () => {
      const later = jest.fn();
      usersService.onDeactivationCheck(() =>
        Promise.reject(new AccountHasActiveTripsError()),
      );
      usersService.onDeactivationCheck(later);

      await expect(
        usersService.assertCanDeactivate('user-1'),
      ).rejects.toBeInstanceOf(AccountHasActiveTripsError);
      expect(later).not.toHaveBeenCalled();
    });
  });

  describe('getActiveProfiles', () => {
    it('lists the active driver and passenger profiles', () => {
      const user = userWith({
        driverProfile: { isActive: true } as User['driverProfile'],
        passengerProfile: { isActive: true } as User['passengerProfile'],
      });

      expect(usersService.getActiveProfiles(user)).toEqual([
        'driver',
        'passenger',
      ]);
    });

    it('leaves out deactivated profiles', () => {
      const user = userWith({
        driverProfile: { isActive: false } as User['driverProfile'],
        passengerProfile: { isActive: true } as User['passengerProfile'],
        adminProfile: { isActive: true } as User['adminProfile'],
      });

      expect(usersService.getActiveProfiles(user)).toEqual([
        'passenger',
        'admin',
      ]);
    });

    it('returns an empty list for a user without profiles', () => {
      expect(usersService.getActiveProfiles(userWith({}))).toEqual([]);
    });
  });

  describe('isAccessRevoked', () => {
    it('is true when every profile it has is deactivated', () => {
      const user = userWith({
        driverProfile: { isActive: false } as User['driverProfile'],
        passengerProfile: { isActive: false } as User['passengerProfile'],
      });

      expect(usersService.isAccessRevoked(user)).toBe(true);
    });

    it('is false with an active profile or none chosen yet', () => {
      const active = userWith({
        driverProfile: { isActive: false } as User['driverProfile'],
        passengerProfile: { isActive: true } as User['passengerProfile'],
      });

      expect(usersService.isAccessRevoked(active)).toBe(false);
      expect(usersService.isAccessRevoked(userWith({}))).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('returns the public data of the user with the active profiles', async () => {
      usersRepository.findOne.mockResolvedValue(
        userWith({
          id: 'user-1',
          firstName: 'Ana',
          lastName: 'García',
          email: 'ana@ual.es',
          passwordHash: 'hash',
          avatarKey: 'sun',
          bio: 'Conductora desde Roquetas al campus de la UAL.',
          conversationPreference: 'chatty',
          passengerProfile: { isActive: true } as User['passengerProfile'],
        }),
      );

      await expect(usersService.getSummary('user-1')).resolves.toEqual({
        id: 'user-1',
        firstName: 'Ana',
        lastName: 'García',
        email: 'ana@ual.es',
        phoneVerified: false,
        profiles: ['passenger'],
        isAccessRevoked: false,
        avatarKey: 'sun',
        bio: 'Conductora desde Roquetas al campus de la UAL.',
        preferences: {
          ...EMPTY_TRAVEL_PREFERENCES,
          conversation: 'chatty',
        },
        ratings: {
          driver: { averageRating: null, ratingCount: 0 },
          passenger: { averageRating: null, ratingCount: 0 },
        },
      });
    });

    it('exposes the role average rating only once the user has at least 3 reviews', async () => {
      usersRepository.findOne.mockResolvedValue(
        userWith({
          id: 'user-1',
          firstName: 'Ana',
          lastName: 'García',
          email: 'ana@ual.es',
          driverProfile: {
            isActive: true,
            averageRating: 4.8,
            ratingCount: 3,
          } as User['driverProfile'],
          passengerProfile: {
            isActive: true,
            averageRating: 4.5,
            ratingCount: 2,
          } as User['passengerProfile'],
        }),
      );

      const summary = await usersService.getSummary('user-1');

      expect(summary.ratings).toEqual({
        driver: { averageRating: 4.8, ratingCount: 3 },
        passenger: { averageRating: null, ratingCount: 2 },
      });
    });

    it('throws USER_NOT_FOUND when the user does not exist or is deactivated', async () => {
      usersRepository.findOne.mockResolvedValueOnce(null);

      await expect(usersService.getSummary('missing')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );

      usersRepository.findOne.mockResolvedValueOnce(
        userWith({ id: 'user-1', deactivatedAt: new Date() }),
      );

      await expect(usersService.getSummary('user-1')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });

  describe('getPublicProfiles', () => {
    it('returns an empty map without querying when given no ids', async () => {
      await expect(usersService.getPublicProfiles([])).resolves.toEqual(
        new Map(),
      );
      expect(usersRepository.find).not.toHaveBeenCalled();
    });

    it('loads the public profile and rating in one query', async () => {
      usersRepository.find.mockResolvedValue([
        userWith({
          id: 'u1',
          firstName: 'Lucía',
          lastName: 'García',
          avatarKey: 'sun',
          conversationPreference: 'chatty',
          smokingPreference: 'no',
          driverProfile: {
            averageRating: 4.8,
            ratingCount: 3,
          } as User['driverProfile'],
        }),
      ]);

      const profiles = await usersService.getPublicProfiles(['u1', 'u1']);

      expect(profiles.get('u1')).toEqual({
        id: 'u1',
        name: 'Lucía',
        avatarKey: 'sun',
        preferences: {
          conversation: 'chatty',
          music: null,
          smoking: 'no',
          pets: null,
        },
        driverRating: 4.8,
      });
      const [query] = usersRepository.find.mock.calls[0] as [
        FindManyOptions<User>,
      ];
      expect(query.select).toMatchObject({
        driverProfile: { averageRating: true, ratingCount: true },
      });
      expect(query.relations).toEqual({ driverProfile: true });
    });

    it('hides the driver average until three reviews have been published', async () => {
      usersRepository.find.mockResolvedValue([
        userWith({
          id: 'u1',
          firstName: 'Lucía',
          lastName: 'García',
          driverProfile: {
            averageRating: 4.8,
            ratingCount: 2,
          } as User['driverProfile'],
        }),
      ]);

      const profiles = await usersService.getPublicProfiles(['u1']);

      expect(profiles.get('u1')?.driverRating).toBeNull();
    });
  });
});
