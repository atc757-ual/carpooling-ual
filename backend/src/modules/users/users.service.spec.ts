import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { UserNotFoundError } from './errors/user-not-found.error';
import { UsersService } from './users.service';
import { VehiclesService } from './vehicles.service';

// Tests unitarios de la lógica que no depende de la base de datos. Lo que sí
// depende de ella (transacción, UNIQUE, citext) se prueba en
// test/users-service.e2e-spec.ts contra PostgreSQL
describe('UsersService', () => {
  let usersService: UsersService;
  const usersRepository = { findOne: jest.fn() };

  beforeEach(async () => {
    usersRepository.findOne.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DataSource, useValue: {} },
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: VehiclesService, useValue: {} },
      ],
    }).compile();

    usersService = moduleRef.get(UsersService);
  });

  function userWith(profiles: Partial<User>): User {
    return Object.assign(new User(), profiles);
  }

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

  describe('getSummary', () => {
    it('returns the public data of the user with the active profiles', async () => {
      usersRepository.findOne.mockResolvedValue(
        userWith({
          id: 'user-1',
          name: 'Ana',
          email: 'ana@ual.es',
          passwordHash: 'hash',
          passengerProfile: { isActive: true } as User['passengerProfile'],
        }),
      );

      await expect(usersService.getSummary('user-1')).resolves.toEqual({
        id: 'user-1',
        name: 'Ana',
        email: 'ana@ual.es',
        profiles: ['passenger'],
      });
    });

    it('throws USER_NOT_FOUND when the user does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(usersService.getSummary('missing')).rejects.toBeInstanceOf(
        UserNotFoundError,
      );
    });
  });
});
