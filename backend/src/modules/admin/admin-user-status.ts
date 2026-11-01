import type { AccountStatus } from '../users/admin-user-filter';

// Estados de un usuario en el panel (chips de la lista): los de la cuenta
// (módulo de usuarios) más los que dependen de otros módulos
export const ADMIN_USER_STATUSES = [
  'active',
  'email_unverified',
  'open_incidents',
  'suspended',
  'profile_deactivated',
  'deleted',
] as const;
export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];

// Estados que filtra el módulo de usuarios; los otros dos se resuelven con
// los ids que dan las incidencias y las cancelaciones tardías
const ACCOUNT_STATUS_SET: ReadonlySet<string> = new Set<AccountStatus>([
  'active',
  'email_unverified',
  'profile_deactivated',
  'deleted',
]);

export function isAccountStatus(
  status: AdminUserStatus,
): status is AccountStatus {
  return ACCOUNT_STATUS_SET.has(status);
}

// Todos los estados de un usuario, del más grave al más leve. «Activo» solo
// si no tiene ningún otro
export function statusesOf(
  account: AccountStatus,
  isSuspended: boolean,
  openIncidents: number,
): AdminUserStatus[] {
  const statuses: AdminUserStatus[] = [];
  if (account !== 'active') {
    statuses.push(account);
  }
  if (isSuspended) {
    statuses.push('suspended');
  }
  if (openIncidents > 0) {
    statuses.push('open_incidents');
  }
  return statuses.length === 0 ? ['active'] : statuses;
}
