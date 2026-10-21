import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { AdminProfile } from './entities/admin-profile.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { PassengerProfile } from './entities/passenger-profile.entity';
import { User } from './entities/user.entity';
import { EmailAlreadyRegisteredError } from './errors/email-already-registered.error';
import { UserNotFoundError } from './errors/user-not-found.error';
import { ProfileType } from './profile-type';
import { UserSummary } from './user-summary';

export interface CreateUserInput {
  name: string;
  email: string;
  // Llega ya convertida en hash: este service nunca ve contraseñas en claro
  passwordHash: string;
  // El registro público solo permite driver y passenger (lo valida auth); admin
  // solo se crea desde dentro del backend (comando create-admin)
  profiles: ProfileType[];
}

// Relaciones que se cargan junto con el usuario
const PROFILE_RELATIONS = {
  driverProfile: true,
  passengerProfile: true,
  adminProfile: true,
};

// Entidad (tabla) de cada perfil
const PROFILE_ENTITIES = {
  driver: DriverProfile,
  passenger: PassengerProfile,
  admin: AdminProfile,
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
  ) {}

  // Crea el usuario y sus perfiles en una transacción: o se guarda todo o nada,
  // así nunca queda un usuario sin perfiles. El correo repetido lo detecta la
  // restricción UNIQUE de la base de datos (también si dos registros llegan a
  // la vez), en lugar de comprobarlo antes con una consulta.
  async createWithProfiles(input: CreateUserInput): Promise<User> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            name: input.name,
            email: input.email,
            passwordHash: input.passwordHash,
          }),
        );
        // Los perfiles no dependen unos de otros. Si falla uno, la transacción
        // deshace también el usuario y el resto de perfiles
        await Promise.all(
          [...new Set(input.profiles)].map((profile) =>
            this.createProfile(manager, user.id, profile),
          ),
        );
        return manager.findOneOrFail(User, {
          where: { id: user.id },
          relations: PROFILE_RELATIONS,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new EmailAlreadyRegisteredError(input.email);
      }
      throw error;
    }
  }

  // Solo para el login: es el único lugar donde se pide el hash explícitamente
  // (la columna tiene select: false en la entidad)
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

  // Usuario con sus perfiles, sin el hash (p. ej. para GET /api/auth/me)
  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: PROFILE_RELATIONS,
    });
  }

  // ¿Hay algún administrador activo? (comando create-admin, RF-01)
  hasActiveAdmin(): Promise<boolean> {
    return this.dataSource
      .getRepository(AdminProfile)
      .existsBy({ isActive: true });
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
      profiles: this.getActiveProfiles(user),
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

  private async createProfile(
    manager: EntityManager,
    userId: string,
    profile: ProfileType,
  ): Promise<void> {
    await manager.save(manager.create(PROFILE_ENTITIES[profile], { userId }));
  }
}
