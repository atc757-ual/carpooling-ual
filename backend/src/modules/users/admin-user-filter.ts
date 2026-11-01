import { Brackets, SelectQueryBuilder } from 'typeorm';
import type { User } from './entities/user.entity';
import type { ProfileType } from './profile-type';

// Estados de la cuenta que decide el propio módulo de usuarios (los que
// dependen de otros módulos, como las incidencias o la suspensión, los
// resuelve el panel con los ids que le dan esos módulos)
export const ACCOUNT_STATUSES = [
  'active',
  'email_unverified',
  'profile_deactivated',
  'deleted',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

// Filtros de la lista de usuarios del panel. userIds limita la lista a esos
// usuarios (p. ej. los que tienen incidencias abiertas)
export interface AdminUserFilter {
  search?: string;
  profile?: ProfileType;
  status?: AccountStatus;
  userIds?: readonly string[];
}

// Alias de la consulta de cada perfil (ver UserProfilesService.list)
const PROFILE_ALIASES: Record<ProfileType, string> = {
  driver: 'driver',
  passenger: 'passenger',
  admin: 'admin',
};

const NOT_DELETED = 'user.deactivatedAt IS NULL';
const ALL_PROFILES_ACTIVE =
  'COALESCE(driver.isActive, true) AND COALESCE(passenger.isActive, true) AND COALESCE(admin.isActive, true)';

const STATUS_CONDITIONS: Record<AccountStatus, string> = {
  deleted: 'user.deactivatedAt IS NOT NULL',
  email_unverified: `${NOT_DELETED} AND user.emailVerifiedAt IS NULL`,
  profile_deactivated: `${NOT_DELETED} AND NOT (${ALL_PROFILES_ACTIVE})`,
  active: `${NOT_DELETED} AND user.emailVerifiedAt IS NOT NULL AND ${ALL_PROFILES_ACTIVE}`,
};

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Añade los filtros a la consulta de usuarios con sus tres perfiles unidos
export function applyAdminUserFilter(
  query: SelectQueryBuilder<User>,
  filter: AdminUserFilter,
): SelectQueryBuilder<User> {
  if (filter.search) {
    const pattern = `%${escapeLike(filter.search)}%`;
    query.andWhere(
      new Brackets((where) =>
        where
          .where('user.name ILIKE :pattern', { pattern })
          .orWhere('user.email ILIKE :pattern', { pattern }),
      ),
    );
  }
  if (filter.profile !== undefined) {
    query.andWhere(`${PROFILE_ALIASES[filter.profile]}.userId IS NOT NULL`);
  }
  if (filter.status !== undefined) {
    query.andWhere(STATUS_CONDITIONS[filter.status]);
  }
  if (filter.userIds !== undefined) {
    query.andWhere('user.id IN (:...userIds)', { userIds: filter.userIds });
  }
  return query;
}

// Estado de la cuenta de un usuario ya cargado con sus perfiles
export function accountStatusOf(
  user: Pick<User, 'deactivatedAt' | 'emailVerifiedAt'>,
  profilesActive: readonly boolean[],
): AccountStatus {
  if (user.deactivatedAt !== null) {
    return 'deleted';
  }
  if (user.emailVerifiedAt === null) {
    return 'email_unverified';
  }
  return profilesActive.every(Boolean) ? 'active' : 'profile_deactivated';
}
