import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { ProfileRequiredError } from '../../shared/auth/profile-required.error';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { AvatarsService } from './avatars.service';
import { ConsentsService } from './consents.service';
import { DriverReadiness } from './driver-readiness';
import { AdminProfile } from './entities/admin-profile.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { PassengerProfile } from './entities/passenger-profile.entity';
import { User } from './entities/user.entity';
import { EmailAlreadyRegisteredError } from './errors/email-already-registered.error';
import { UserNotFoundError } from './errors/user-not-found.error';
import { PROFILE_ENTITIES } from './profile-entities';
import { ProfileType } from './profile-type';
import type { AvatarKey, TravelPreferences } from './travel-preferences';
import { PublicUserProfile, UserSummary } from './user-summary';
import { VehiclesService } from './vehicles.service';

// Lo que el usuario puede cambiar de su cuenta y su perfil público
// (PATCH /api/users/me)
export interface AccountChanges {
  name?: string;
  phone?: string;
  timeToleranceMin?: number;
  avatarKey?: AvatarKey | null;
  bio?: string | null;
  preferences?: Partial<TravelPreferences>;
}

const DIRECT_ACCOUNT_FIELDS = [
  'name',
  'phone',
  'timeToleranceMin',
  'avatarKey',
  'bio',
] as const;

const PREFERENCE_COLUMN_MAP = [
  ['conversation', 'conversationPreference'],
  ['music', 'musicPreference'],
  ['smoking', 'smokingPreference'],
  ['pets', 'petsPreference'],
] as const;

export interface CreateUserInput {
  name: string;
  email: string;
  // Llega ya convertida en hash: este service nunca ve contraseñas en claro
  passwordHash: string;
  profiles: ProfileType[];
  phone?: string;
  termsAcceptedAt?: Date;
  isEmailVerified?: boolean;
}

const PROFILE_RELATIONS = {
  driverProfile: true,
  passengerProfile: true,
  adminProfile: true,
};

const EMAIL_UNIQUE_CONSTRAINT = 'users_email_key';

// Capa de negocio del módulo users: crear y buscar usuarios correctamente.
// Es lo único que exporta el módulo; los demás módulos nunca usan sus tablas
// ni sus repositorios directamente.
@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly vehiclesService: VehiclesService,
    private readonly avatarsService: AvatarsService,
    private readonly consentsService: ConsentsService,
    private readonly eventsService: EventsService,
  ) {}

  async createWithProfiles(
    input: CreateUserInput,
    manager?: EntityManager,
  ): Promise<User> {
    try {
      return manager
        ? await this.insertUser(manager, input)
        : await this.dataSource.transaction((own) =>
            this.insertUser(own, input),
          );
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new EmailAlreadyRegisteredError(input.email);
      }
      throw error;
    }
  }

  private async insertUser(
    manager: EntityManager,
    input: CreateUserInput,
  ): Promise<User> {
    const termsAcceptedAt = input.termsAcceptedAt
      ? new Date(input.termsAcceptedAt.getTime())
      : null;
    const user = await manager.save(
      manager.create(User, {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        phone: input.phone ?? null,
        termsAcceptedAt,
        emailVerifiedAt: input.isEmailVerified ? new Date() : null,
      }),
    );
    const profiles = [...new Set(input.profiles)];
    await Promise.all(
      profiles.map((profile) => this.createProfile(manager, user.id, profile)),
    );
    await this.eventsService.record(manager, {
      type: 'user.registered',
      sourceEntityId: user.id,
      payload: { profiles },
    });
    if (termsAcceptedAt !== null) {
      await this.consentsService.recordInitialConsents(
        manager,
        user.id,
        termsAcceptedAt,
      );
    }
    return manager.findOneOrFail(User, {
      where: { id: user.id },
      relations: PROFILE_RELATIONS,
    });
  }

  async changePassword(
    manager: EntityManager,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await manager.update(User, { id: userId }, { passwordHash });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.driverProfile', 'driverProfile')
      .leftJoinAndSelect('user.passengerProfile', 'passengerProfile')
      .leftJoinAndSelect('user.adminProfile', 'adminProfile')
      .where('user.email = :email', { email })
      .getOne();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: PROFILE_RELATIONS,
    });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: PROFILE_RELATIONS,
    });
  }

  async declareDriverLicense(userId: string): Promise<DriverReadiness> {
    const profile = await this.findActiveDriverProfile(userId);
    if (!profile.hasLicenseDeclared) {
      await this.dataSource.getRepository(DriverProfile).update(userId, {
        hasLicenseDeclared: true,
        licenseDeclaredAt: new Date(),
      });
    }
    return this.getDriverReadiness(userId);
  }

  // Cambiar los datos de la propia cuenta y del perfil público. Solo registra
  // evento si algo cambia; el evento no lleva nombre, teléfono ni texto libre
  // («Sobre mí») por minimización, solo qué campos cambiaron y la tolerancia
  async updateMe(userId: string, changes: AccountChanges): Promise<void> {
    if (changes.avatarKey !== undefined && changes.avatarKey !== null) {
      await this.avatarsService.getActive(changes.avatarKey);
    }
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (user === null) {
        throw new UserNotFoundError(userId);
      }
      const { update, changedFields } = buildAccountUpdate(user, changes);
      if (changedFields.length === 0) {
        return;
      }
      await manager.update(User, { id: userId }, update);
      await this.eventsService.record(manager, {
        type: 'user.updated',
        sourceEntityId: userId,
        payload: {
          changedFields,
          timeToleranceMin: update.timeToleranceMin ?? user.timeToleranceMin,
        },
      });
    });
  }

  async getDriverReadiness(userId: string): Promise<DriverReadiness> {
    const profile = await this.findActiveDriverProfile(userId);
    const activeVehicles = await this.vehiclesService.countActive(userId);
    return {
      hasLicenseDeclared: profile.hasLicenseDeclared,
      licenseDeclaredAt: profile.licenseDeclaredAt,
      activeVehicles,
      isReady: profile.hasLicenseDeclared && activeVehicles > 0,
    };
  }

  async getPassengerPriority(userId: string): Promise<boolean> {
    const profile = await this.dataSource
      .getRepository(PassengerProfile)
      .findOneBy({ userId, isActive: true });
    if (profile === null) {
      throw new ProfileRequiredError(['passenger']);
    }
    return profile.hasHighPriority;
  }

  async grantPassengerPriority(
    manager: EntityManager,
    passengerIds: string[],
  ): Promise<void> {
    if (passengerIds.length === 0) {
      return;
    }
    await manager.update(
      PassengerProfile,
      { userId: In(passengerIds) },
      { hasHighPriority: true },
    );
  }

  async clearPassengerPriority(
    manager: EntityManager,
    passengerId: string,
  ): Promise<void> {
    await manager.update(
      PassengerProfile,
      { userId: passengerId },
      { hasHighPriority: false },
    );
  }

  // Nombres de varios usuarios en UNA consulta (para las listas: evita una
  // consulta por cada fila)
  async getNames(userIds: string[]): Promise<Map<string, string>> {
    const users = await this.usersRepository.find({
      select: { id: true, name: true },
      where: { id: In([...new Set(userIds)]) },
    });
    return new Map(users.map(({ id, name }) => [id, name]));
  }

  // Perfil público (nombre, avatar y preferencias) de varios usuarios en UNA
  // sola consulta, para viajes, resultados de matching y solicitudes
  async getPublicProfiles(
    userIds: string[],
  ): Promise<Map<string, PublicUserProfile>> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const users = await this.usersRepository.find({
      select: {
        id: true,
        name: true,
        avatarKey: true,
        conversationPreference: true,
        musicPreference: true,
        smokingPreference: true,
        petsPreference: true,
      },
      where: { id: In(uniqueIds) },
    });
    return new Map(users.map((user) => [user.id, toPublicProfile(user)]));
  }

  hasActiveAdmin(): Promise<boolean> {
    return this.dataSource
      .getRepository(AdminProfile)
      .existsBy({ isActive: true });
  }

  async getActiveAdminIds(manager: EntityManager): Promise<string[]> {
    const admins = await manager
      .createQueryBuilder(User, 'u')
      .select('u.id', 'id')
      .innerJoin('u.adminProfile', 'admin', 'admin.isActive = true')
      .setLock('for_key_share', undefined, ['u'])
      .getRawMany<{ id: string }>();
    return admins.map(({ id }) => id);
  }

  // Datos de la cuenta de un usuario (GET /api/users/me, GET /api/users/{id})
  async getSummary(id: string): Promise<UserSummary> {
    const user = await this.findById(id);
    if (user === null) {
      throw new UserNotFoundError(id);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profiles: this.getActiveProfiles(user),
      activeMode: user.activeMode,
      timeToleranceMin: user.timeToleranceMin,
      avatarKey: user.avatarKey,
      bio: user.bio,
      preferences: toTravelPreferences(user),
    };
  }

  getActiveProfiles(user: User): ProfileType[] {
    const profiles: [ProfileType, { isActive: boolean } | null | undefined][] =
      [
        ['driver', user.driverProfile],
        ['passenger', user.passengerProfile],
        ['admin', user.adminProfile],
      ];
    return profiles
      .filter(([, profile]) => profile?.isActive === true)
      .map(([type]) => type);
  }

  private async findActiveDriverProfile(
    userId: string,
  ): Promise<DriverProfile> {
    const profile = await this.dataSource
      .getRepository(DriverProfile)
      .findOneBy({ userId, isActive: true });
    if (profile === null) {
      throw new ProfileRequiredError(['driver']);
    }
    return profile;
  }

  private async createProfile(
    manager: EntityManager,
    userId: string,
    profile: ProfileType,
  ): Promise<void> {
    await manager.save(manager.create(PROFILE_ENTITIES[profile], { userId }));
  }
}

function toTravelPreferences(user: User): TravelPreferences {
  return {
    conversation: user.conversationPreference ?? null,
    music: user.musicPreference ?? null,
    smoking: user.smokingPreference ?? null,
    pets: user.petsPreference ?? null,
  };
}

function toPublicProfile(user: User): PublicUserProfile {
  return {
    id: user.id,
    name: user.name,
    avatarKey: user.avatarKey ?? null,
    preferences: toTravelPreferences(user),
  };
}

function buildAccountUpdate(
  user: User,
  changes: AccountChanges,
): { update: Partial<User>; changedFields: string[] } {
  const changedDirect = DIRECT_ACCOUNT_FIELDS.filter(
    (field) => changes[field] !== undefined && changes[field] !== user[field],
  );
  const update: Partial<User> = Object.fromEntries(
    changedDirect.map((field) => [field, changes[field]]),
  );
  const changedFields: string[] = [...changedDirect];

  if (changes.preferences !== undefined) {
    let preferencesChanged = false;
    for (const [key, column] of PREFERENCE_COLUMN_MAP) {
      const nextValue = changes.preferences[key];
      if (nextValue !== undefined && nextValue !== user[column]) {
        (update as Record<string, unknown>)[column] = nextValue;
        preferencesChanged = true;
      }
    }
    if (preferencesChanged) {
      changedFields.push('preferences');
    }
  }
  return { update, changedFields };
}
