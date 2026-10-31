import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { InvalidRefreshTokenError } from '../src/modules/auth/errors/invalid-refresh-token.error';
import { RefreshTokensService } from '../src/modules/auth/refresh-tokens.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { CannotChangeOwnAdminError } from '../src/modules/users/errors/cannot-change-own-admin.error';
import { ProfileNotFoundError } from '../src/modules/users/errors/profile-not-found.error';
import { UserNotFoundError } from '../src/modules/users/errors/user-not-found.error';
import type { ProfileType } from '../src/modules/users/profile-type';
import { UserProfilesService } from '../src/modules/users/user-profiles.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { ProfileRequiredError } from '../src/shared/auth/profile-required.error';
import { deleteTestUsers } from './support/cleanup';

// Gestión de perfiles por el administrador (RF-25) contra la base de datos
// real. Los usuarios llevan el prefijo EMAIL_PREFIX y se borran con todo lo
// suyo (también sus eventos)
const EMAIL_PREFIX = 'profiles-test-';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};

describe('UserProfilesService (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userProfiles: UserProfilesService;
  let usersService: UsersService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    userProfiles = app.get(UserProfilesService);
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
    profiles: ProfileType[],
  ): Promise<string> {
    const user = await usersService.createWithProfiles({
      name,
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      passwordHash: 'hash',
      profiles,
    });
    return user.id;
  }

  async function activeProfilesOf(userId: string): Promise<ProfileType[]> {
    const user = await usersService.findById(userId);
    return user === null ? [] : usersService.getActiveProfiles(user);
  }

  function eventTypesOf(userId: string): Promise<string[]> {
    return dataSource.manager
      .find(DomainEvent, {
        where: { sourceEntityId: userId },
        order: { occurredAt: 'ASC' },
      })
      .then((events) => events.map(({ type }) => type));
  }

  it('records user.registered with the profiles (not the name or email)', async () => {
    const pia = await createUser('pia', ['passenger', 'driver']);

    const [event] = await dataSource.manager.findBy(DomainEvent, {
      sourceEntityId: pia,
    });

    expect(event.type).toBe('user.registered');
    expect(event.payload).toEqual({ profiles: ['passenger', 'driver'] });
  });

  it('assigns the administrator profile and later removes it', async () => {
    const ada = await createUser('ada', ['admin']);
    const pia = await createUser('pia', ['passenger']);

    await userProfiles.setProfileActive(ada, pia, 'admin', true);
    expect(await activeProfilesOf(pia)).toEqual(['passenger', 'admin']);

    await userProfiles.setProfileActive(ada, pia, 'admin', false);
    expect(await activeProfilesOf(pia)).toEqual(['passenger']);
    expect(await eventTypesOf(pia)).toEqual([
      'user.registered',
      'user.profile_activated',
      'user.profile_deactivated',
    ]);
  });

  it('is idempotent: setting the same state again changes nothing', async () => {
    const ada = await createUser('ada', ['admin']);
    const pia = await createUser('pia', ['passenger']);

    await userProfiles.setProfileActive(ada, pia, 'passenger', false);
    await userProfiles.setProfileActive(ada, pia, 'passenger', false);
    // Retirar un perfil que nunca tuvo tampoco cambia nada
    await userProfiles.setProfileActive(ada, pia, 'admin', false);

    expect(await eventTypesOf(pia)).toEqual([
      'user.registered',
      'user.profile_deactivated',
    ]);
  });

  it('does not let administrators remove their own administrator profile', async () => {
    const ada = await createUser('ada', ['admin']);

    await expect(
      userProfiles.setProfileActive(ada, ada, 'admin', false),
    ).rejects.toBeInstanceOf(CannotChangeOwnAdminError);
  });

  it('only activates driver or passenger profiles that the user already has', async () => {
    const ada = await createUser('ada', ['admin']);
    const pia = await createUser('pia', ['passenger']);

    await expect(
      userProfiles.setProfileActive(ada, pia, 'driver', true),
    ).rejects.toBeInstanceOf(ProfileNotFoundError);
    await expect(
      userProfiles.setProfileActive(
        ada,
        '00000000-0000-4000-8000-000000000000',
        'driver',
        true,
      ),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('closes all the sessions of a user when one of their profiles is deactivated', async () => {
    const ada = await createUser('ada', ['admin']);
    const pia = await createUser('pia', ['passenger']);
    const refreshTokens = app.get(RefreshTokensService);
    const web = await refreshTokens.issue(pia);
    const mobile = await refreshTokens.issue(pia);

    await userProfiles.setProfileActive(ada, pia, 'passenger', false);

    await expect(refreshTokens.rotate(web.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    await expect(refreshTokens.rotate(mobile.token)).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  describe('list and admin view (RF-25)', () => {
    const ALL = { offset: 0, limit: 100 };

    it('lists users with ALL their profiles, active or not', async () => {
      const ada = await createUser('ada', ['admin']);
      const pia = await createUser('pia', ['passenger', 'driver']);
      await userProfiles.setProfileActive(ada, pia, 'driver', false);

      const view = await userProfiles.getAdminView(pia);

      expect(view.profiles).toEqual([
        { profile: 'driver', isActive: false },
        { profile: 'passenger', isActive: true },
      ]);
    });

    it('searches by name or email, ignoring case, ordered by name', async () => {
      await createUser('pia', ['passenger']);
      await createUser('dan', ['driver']);

      const byEmail = await userProfiles.list(EMAIL_PREFIX.toUpperCase(), ALL);
      const byName = await userProfiles.list('PI', ALL);

      expect(byEmail.items.map(({ user }) => user.name)).toEqual([
        'dan',
        'pia',
      ]);
      expect(byName.items.map(({ user }) => user.name)).toContain('pia');
      expect(byName.items.map(({ user }) => user.name)).not.toContain('dan');
    });

    it('treats % and _ in the search as text, not as wildcards', async () => {
      await createUser('pia', ['passenger']);

      const page = await userProfiles.list(`${EMAIL_PREFIX}%`, ALL);

      expect(page.total).toBe(0);
    });

    it('paginates the list', async () => {
      await createUser('pia', ['passenger']);
      await createUser('dan', ['driver']);

      const page = await userProfiles.list(EMAIL_PREFIX, {
        offset: 1,
        limit: 1,
      });

      expect(page.total).toBe(2);
      expect(page.items.map(({ user }) => user.name)).toEqual(['pia']);
    });

    it('answers USER_NOT_FOUND for the admin view of an unknown user', async () => {
      await expect(
        userProfiles.getAdminView('00000000-0000-4000-8000-000000000000'),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  it('a deactivated driver keeps their trips but cannot publish new ones', async () => {
    const ada = await createUser('ada', ['admin']);
    const dan = await createUser('dan', ['driver']);
    await usersService.declareDriverLicense(dan);
    const vehicle = await app.get(VehiclesService).register(dan, {
      plate: '9961BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const tripsService = app.get(TripsService);
    const tripInput = {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      offeredSeats: 3,
    };
    const { trip } = await tripsService.publish(dan, tripInput);

    await userProfiles.setProfileActive(ada, dan, 'driver', false);

    await expect(tripsService.publish(dan, tripInput)).rejects.toBeInstanceOf(
      ProfileRequiredError,
    );
    const { trip: stillThere } = await tripsService.getById(trip.id);
    expect(stillThere.status).toBe('published');
  });
});
