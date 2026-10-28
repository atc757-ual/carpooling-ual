import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, ILike } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { ProfileRequiredError } from '../../shared/auth/profile-required.error';
import { Page, PageRequest } from '../../shared/pagination/page';
import { AdminProfile } from './entities/admin-profile.entity';
import { User } from './entities/user.entity';
import { CannotChangeOwnAdminError } from './errors/cannot-change-own-admin.error';
import { LastAdminError } from './errors/last-admin.error';
import { ProfileDeactivatedByAdminError } from './errors/profile-deactivated-by-admin.error';
import { ProfileNotFoundError } from './errors/profile-not-found.error';
import { UserNotFoundError } from './errors/user-not-found.error';
import { PROFILE_ENTITIES } from './profile-entities';
import type { ProfileType, RegistrableProfile } from './profile-type';

export interface ProfileChange {
  userId: string;
  profile: ProfileType;
  isActive: boolean;
}

// Un perfil del usuario y si está activo (el administrador ve también los
// inactivos)
export interface ProfileStatus {
  profile: ProfileType;
  isActive: boolean;
}

// Lo que ve el administrador de un usuario: sus datos y TODOS sus perfiles
export interface UserAdminView {
  user: User;
  profiles: ProfileStatus[];
}

// Relaciones que se cargan junto con el usuario
const PROFILE_RELATIONS = {
  driverProfile: true,
  passengerProfile: true,
  adminProfile: true,
};

// Suscriptor de los cambios de perfil (patrón observador). Se ejecuta DENTRO
// de la transacción del cambio: si falla, se deshace todo
export type ProfileChangeListener = (
  manager: EntityManager,
  change: ProfileChange,
) => Promise<void>;

// Gestión de perfiles: por el administrador (RF-25, CU-13: asignar o retirar
// el de administrador y desactivar o reactivar los demás) y por el propio
// usuario al elegir su modo después de registrarse
@Injectable()
export class UserProfilesService {
  private readonly listeners: ProfileChangeListener[] = [];

  constructor(
    private readonly dataSource: DataSource,
    private readonly eventsService: EventsService,
  ) {}

  // Patrón observador: p. ej. auth cierra las sesiones del usuario cuando se
  // le desactiva un perfil (users no conoce a auth, que depende de él)
  onProfileChanged(listener: ProfileChangeListener): void {
    this.listeners.push(listener);
  }

  // Usuarios para el panel del administrador, por nombre. search busca en el
  // nombre o el correo, sin distinguir mayúsculas
  async list(
    search: string | undefined,
    page: PageRequest,
  ): Promise<Page<UserAdminView>> {
    const pattern = search ? `%${escapeLike(search)}%` : undefined;
    const [users, total] = await this.dataSource
      .getRepository(User)
      .findAndCount({
        where: pattern
          ? [{ name: ILike(pattern) }, { email: ILike(pattern) }]
          : {},
        relations: PROFILE_RELATIONS,
        order: { name: 'ASC', id: 'ASC' },
        skip: page.offset,
        take: page.limit,
      });
    return { items: users.map(toAdminView), total };
  }

  // Un usuario con todos sus perfiles (GET /api/users/{id} de un administrador)
  async getAdminView(userId: string): Promise<UserAdminView> {
    const user = await this.dataSource.getRepository(User).findOne({
      where: { id: userId },
      relations: PROFILE_RELATIONS,
    });
    if (user === null) {
      throw new UserNotFoundError(userId);
    }
    return toAdminView(user);
  }

  // Activa o desactiva un perfil. Para el de administrador, activar es
  // asignarlo (se crea si no lo tenía) y desactivar es retirarlo. Idempotente:
  // si ya estaba así, no cambia nada
  async setProfileActive(
    adminId: string,
    userId: string,
    profile: ProfileType,
    isActive: boolean,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      if (!(await manager.existsBy(User, { id: userId }))) {
        throw new UserNotFoundError(userId);
      }
      if (profile === 'admin' && !isActive) {
        await this.assertCanRemoveAdmin(manager, adminId, userId);
      }

      const entity = PROFILE_ENTITIES[profile];
      const current = await manager.findOne(entity, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (current === null) {
        if (!isActive) {
          return;
        }
        if (profile !== 'admin') {
          throw new ProfileNotFoundError(userId, profile);
        }
        await manager.save(manager.create(AdminProfile, { userId }));
      } else if (current.isActive === isActive) {
        return;
      } else {
        await manager.update(entity, { userId }, { isActive });
      }
      await this.notify(manager, adminId, { userId, profile, isActive });
    });
  }

  // El propio usuario elige su modo (conductor y/o pasajero) después de
  // registrarse. Solo puede AÑADIR un perfil que no tenía: si un administrador
  // se lo desactivó, no puede reactivárselo él mismo. Idempotente: si ya lo
  // tiene activo, no cambia nada
  async activateOwnProfile(
    userId: string,
    profile: RegistrableProfile,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Se bloquea la fila del usuario: dos peticiones a la vez (doble clic)
      // no pueden crear el mismo perfil dos veces
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (user === null) {
        throw new UserNotFoundError(userId);
      }
      const entity = PROFILE_ENTITIES[profile];
      const current = await manager.findOneBy(entity, { userId });
      if (current?.isActive) {
        return;
      }
      if (current !== null) {
        throw new ProfileDeactivatedByAdminError(profile);
      }
      await manager.save(manager.create(entity, { userId }));
      await this.notify(manager, userId, {
        userId,
        profile,
        isActive: true,
      });
    });
  }

  // El modo con el que viaja ahora, el mismo en todos sus dispositivos: solo
  // uno de sus perfiles activos. Idempotente: con el mismo modo no cambia nada
  // ni registra evento
  async setActiveMode(userId: string, mode: RegistrableProfile): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (user === null) {
        throw new UserNotFoundError(userId);
      }
      const profile = await manager.findOneBy(PROFILE_ENTITIES[mode], {
        userId,
      });
      if (!profile?.isActive) {
        throw new ProfileRequiredError([mode]);
      }
      if (user.activeMode === mode) {
        return;
      }
      await manager.update(User, { id: userId }, { activeMode: mode });
      await this.eventsService.record(manager, {
        type: 'user.active_mode_changed',
        sourceEntityId: userId,
        payload: { activeMode: mode, previousMode: user.activeMode },
      });
    });
  }

  // No retirarse a uno mismo ni dejar la plataforma sin administradores. Se
  // bloquean los perfiles de administrador activos: dos administradores no
  // pueden retirarse el uno al otro a la vez
  private async assertCanRemoveAdmin(
    manager: EntityManager,
    adminId: string,
    userId: string,
  ): Promise<void> {
    if (userId === adminId) {
      throw new CannotChangeOwnAdminError();
    }
    const activeAdmins = await manager.find(AdminProfile, {
      where: { isActive: true },
      lock: { mode: 'pessimistic_write' },
    });
    const isTarget = (admin: AdminProfile): boolean => admin.userId === userId;
    if (activeAdmins.some(isTarget) && activeAdmins.length === 1) {
      throw new LastAdminError();
    }
  }

  // Evento para el Gemelo Digital y aviso a los suscriptores. changedBy es el
  // administrador o, al elegir su modo, el propio usuario
  private async notify(
    manager: EntityManager,
    changedBy: string,
    change: ProfileChange,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type: change.isActive
        ? 'user.profile_activated'
        : 'user.profile_deactivated',
      sourceEntityId: change.userId,
      payload: { profile: change.profile, changedBy },
    });
    await Promise.all(
      this.listeners.map((listener) => listener(manager, change)),
    );
  }
}

function toAdminView(user: User): UserAdminView {
  const profiles: [ProfileType, { isActive: boolean } | null | undefined][] = [
    ['driver', user.driverProfile],
    ['passenger', user.passengerProfile],
    ['admin', user.adminProfile],
  ];
  return {
    user,
    profiles: profiles.flatMap(([profile, entity]) =>
      entity ? [{ profile, isActive: entity.isActive }] : [],
    ),
  };
}

// Los comodines de LIKE (% y _) que escriba el administrador se buscan como
// texto, no como comodines
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
