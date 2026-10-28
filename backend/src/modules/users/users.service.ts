import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { ProfileRequiredError } from '../../shared/auth/profile-required.error';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { DriverReadiness } from './driver-readiness';
import { AdminProfile } from './entities/admin-profile.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { PassengerProfile } from './entities/passenger-profile.entity';
import { User } from './entities/user.entity';
import { EmailAlreadyRegisteredError } from './errors/email-already-registered.error';
import { UserNotFoundError } from './errors/user-not-found.error';
import { PROFILE_ENTITIES } from './profile-entities';
import { ProfileType } from './profile-type';
import { UserSummary } from './user-summary';
import { VehiclesService } from './vehicles.service';

// Lo que el usuario puede cambiar de su cuenta (PATCH /api/users/me)
export interface AccountChanges {
  name?: string;
  phone?: string;
  timeToleranceMin?: number;
}

const ACCOUNT_FIELDS = ['name', 'phone', 'timeToleranceMin'] as const;

export interface CreateUserInput {
  name: string;
  email: string;
  // Llega ya convertida en hash: este service nunca ve contraseñas en claro
  passwordHash: string;
  // El registro público crea el usuario sin perfiles (los elige después de
  // verificar el correo); admin solo se crea desde dentro del backend
  // (comando create-admin)
  profiles: ProfileType[];
  // Solo los da el registro público
  phone?: string;
  termsAcceptedAt?: Date;
  // El registro público crea el usuario sin verificar (verifica el correo con
  // un código); el administrador inicial (create-admin) se crea verificado
  isEmailVerified?: boolean;
}

// Relaciones que se cargan junto con el usuario
const PROFILE_RELATIONS = {
  driverProfile: true,
  passengerProfile: true,
  adminProfile: true,
};

// Restricción UNIQUE del correo en la tabla users (migración InitialSchema)
const EMAIL_UNIQUE_CONSTRAINT = 'users_email_key';

// Capa de negocio del módulo users: crear y buscar usuarios correctamente.
// Es lo único que exporta el módulo; los demás módulos (p. ej. auth) nunca
// usan sus tablas ni sus repositorios directamente.
@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly vehiclesService: VehiclesService,
    private readonly eventsService: EventsService,
  ) {}

  // Crea el usuario y sus perfiles (si los hay) en una transacción: o se
  // guarda todo o nada. Con el manager de quien llama, dentro de su
  // transacción (p. ej. al verificar un registro pendiente, que se borra a la
  // vez). El correo repetido lo detecta la restricción UNIQUE de la base de
  // datos (también si dos registros llegan a la vez), en lugar de comprobarlo
  // antes con una consulta.
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
    const user = await manager.save(
      manager.create(User, {
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        phone: input.phone ?? null,
        termsAcceptedAt: input.termsAcceptedAt ?? null,
        emailVerifiedAt: input.isEmailVerified ? new Date() : null,
      }),
    );
    // Los perfiles no dependen unos de otros. Si falla uno, la transacción
    // deshace también el usuario y el resto de perfiles
    const profiles = [...new Set(input.profiles)];
    await Promise.all(
      profiles.map((profile) => this.createProfile(manager, user.id, profile)),
    );
    // Evento para el Gemelo Digital: solo los perfiles (ni el nombre, ni el
    // correo, ni el teléfono, que no necesita: minimización)
    await this.eventsService.record(manager, {
      type: 'user.registered',
      sourceEntityId: user.id,
      payload: { profiles },
    });
    return manager.findOneOrFail(User, {
      where: { id: user.id },
      relations: PROFILE_RELATIONS,
    });
  }

  // Nueva contraseña (ya cifrada), en la transacción de quien llama (la que
  // gasta el código de recuperación)
  async changePassword(
    manager: EntityManager,
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    await manager.update(User, { id: userId }, { passwordHash });
  }

  // Para el login y la recuperación de la contraseña: los únicos lugares donde
  // se pide el hash explícitamente (la columna tiene select: false)
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

  // Usuario por su correo, sin el hash (verificación del correo). citext: no
  // distingue mayúsculas
  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: PROFILE_RELATIONS,
    });
  }

  // Usuario con sus perfiles, sin el hash (p. ej. para GET /api/auth/me)
  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: PROFILE_RELATIONS,
    });
  }

  // Declaración responsable del conductor (RF-21): tiene licencia en vigor y sus
  // vehículos son aptos. Es idempotente: si ya la había aceptado, conserva la
  // fecha de la primera, que es la que tiene valor legal
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

  // Cambiar los datos de la propia cuenta (nombre, teléfono y tolerancia
  // horaria). Solo registra evento si algo cambia; el evento no lleva el
  // nombre ni el teléfono (el Gemelo Digital no los necesita: minimización),
  // solo qué campos cambiaron y la tolerancia
  async updateMe(userId: string, changes: AccountChanges): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (user === null) {
        throw new UserNotFoundError(userId);
      }
      const changedFields = ACCOUNT_FIELDS.filter(
        (field) =>
          changes[field] !== undefined && changes[field] !== user[field],
      );
      if (changedFields.length === 0) {
        return;
      }
      const update = Object.fromEntries(
        changedFields.map((field) => [field, changes[field]]),
      ) as AccountChanges;
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

  // ¿Puede publicar viajes? (RF-21). Lo usan los viajes y el frontend, para
  // saber qué le falta al conductor
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

  // RF-24: prioridad del pasajero (afectado por la cancelación de un viaje en
  // curso). Sin perfil de pasajero activo, la acción requiere ese perfil
  async getPassengerPriority(userId: string): Promise<boolean> {
    const profile = await this.dataSource
      .getRepository(PassengerProfile)
      .findOneBy({ userId, isActive: true });
    if (profile === null) {
      throw new ProfileRequiredError(['passenger']);
    }
    return profile.hasHighPriority;
  }

  // RF-24: prioridad alta para los pasajeros afectados por la cancelación de
  // un viaje en curso. Recibe el manager de la transacción de la cancelación
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

  // La prioridad se pierde cuando ya ha cumplido su función: al aceptarse su
  // siguiente solicitud prioritaria
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

  // ¿Hay algún administrador activo? (comando create-admin, RF-01)
  hasActiveAdmin(): Promise<boolean> {
    return this.dataSource
      .getRepository(AdminProfile)
      .existsBy({ isActive: true });
  }

  // Ids de los administradores activos (p. ej. para avisarles de una
  // incidencia nueva, RF-19). Recibe el manager de la transacción del cambio.
  // Sus usuarios quedan bloqueados con FOR KEY SHARE (el mismo bloqueo que
  // toma una clave foránea) hasta el final de la transacción: si alguien borra
  // a uno a la vez, espera, y un usuario ya borrado no se devuelve. Así el
  // aviso nunca apunta a un usuario que ya no existe
  async getActiveAdminIds(manager: EntityManager): Promise<string[]> {
    const admins = await manager
      .createQueryBuilder(User, 'u')
      .select('u.id', 'id')
      .innerJoin('u.adminProfile', 'admin', 'admin.isActive = true')
      .setLock('for_key_share', undefined, ['u'])
      .getRawMany<{ id: string }>();
    return admins.map(({ id }) => id);
  }

  // Datos públicos de un usuario (GET /api/users/{id}). Si no existe, lanza
  // UserNotFoundError
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
    };
  }

  // Perfiles activos del usuario, p. ej. ['driver', 'passenger']. Van en el
  // token y con ellos se comprueban los permisos por perfil (RNF-04)
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

  // El perfil de conductor activo del usuario; si no lo tiene, la acción
  // requiere el perfil de conductor
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
