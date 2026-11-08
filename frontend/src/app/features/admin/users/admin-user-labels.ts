import { AdminUserRow, AdminUserStatus } from '../../../core/models/admin-user.model';
import { Profile } from '../../../core/models/user.model';

// Textos de la lista de usuarios del panel. Funciones puras para probarlas
// sin pantalla

export type ChipTone = 'success' | 'info' | 'warning' | 'neutral';

export interface StatusChip {
  label: string;
  tone: ChipTone;
}

export const PROFILE_LABELS: Record<Profile, string> = {
  driver: 'Conductor',
  passenger: 'Pasajero',
  admin: 'Administrador',
};

export const STATUS_LABELS: Record<AdminUserStatus, string> = {
  active: 'Activo',
  email_unverified: 'Correo sin verificar',
  open_incidents: 'Con incidencias abiertas',
  suspended: 'Suspendido',
  profile_deactivated: 'Perfil desactivado',
  deleted: 'Cuenta eliminada',
};

export const STATUS_TONES: Record<AdminUserStatus, ChipTone> = {
  active: 'success',
  email_unverified: 'info',
  open_incidents: 'warning',
  suspended: 'warning',
  profile_deactivated: 'neutral',
  deleted: 'neutral',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

// «Conductor · Pasajero»: solo los perfiles activos, en este orden
export function rolesLabel(row: Pick<AdminUserRow, 'profiles'>): string {
  const active = new Set(
    row.profiles.filter(({ isActive }) => isActive).map(({ profile }) => profile),
  );
  const ordered = (['driver', 'passenger', 'admin'] as const).filter((profile) =>
    active.has(profile),
  );
  return ordered.length === 0
    ? 'Sin perfil activo'
    : ordered.map((p) => PROFILE_LABELS[p]).join(' · ');
}

// La última fecha de fin entre los dos papeles
function suspensionEnd(row: Pick<AdminUserRow, 'suspensions'>): Date | null {
  const ends = [row.suspensions?.driver, row.suspensions?.passenger]
    .filter((end): end is string => typeof end === 'string')
    .map((end) => new Date(end).getTime());
  return ends.length === 0 ? null : new Date(Math.max(...ends));
}

function chipLabel(row: AdminUserRow, status: AdminUserStatus): string {
  if (status === 'open_incidents') {
    return row.openIncidents === 1 ? '1 incidencia' : `${row.openIncidents} incidencias`;
  }
  const end = status === 'suspended' ? suspensionEnd(row) : null;
  return end ? `Suspendido hasta el ${DATE_FORMAT.format(end)}` : STATUS_LABELS[status];
}

// Un chip por estado, del más grave al más leve (el texto lo dice; el color
// solo acompaña)
export function statusChips(row: AdminUserRow): StatusChip[] {
  return row.statuses.map((status) => ({
    label: chipLabel(row, status),
    tone: STATUS_TONES[status],
  }));
}
