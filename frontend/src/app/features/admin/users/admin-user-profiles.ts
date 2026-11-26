import { AdminUserDetail } from '../../../core/models/admin-user.model';
import { Profile } from '../../../core/models/user.model';
import { ratingLabel } from './admin-user-detail-labels';
import { PROFILE_LABELS } from './admin-user-labels';

export interface ProfileRow {
  profile: Profile;
  label: string;
  // Si la cuenta tiene el perfil (activo o no)
  hasProfile: boolean;
  isActive: boolean;
  rating: string | null;
  // «Activo», «Desactivado» o «No lo tiene»
  stateText: string;
  actionText: string;
  // El administrador no puede retirarse su propio perfil de administrador
  // (el backend lo rechaza): en su ficha no se ofrece
  canChange: boolean;
}

// Textos de la acción: el que no tiene un perfil lo recibe («Conceder»); el
// de administrador se retira y los demás se inhabilitan o se habilitan
const ACTION_TEXTS = {
  admin: { active: 'Revocar', inactive: 'Conceder' },
  other: { active: 'Inhabilitar', inactive: 'Habilitar' },
} as const;
const GRANT_TEXT = 'Conceder';

function stateTextFor(hasProfile: boolean, isActive: boolean): string {
  if (isActive) {
    return 'Activo';
  }
  return hasProfile ? 'Desactivado' : 'No lo tiene';
}

function actionTextFor(profile: Profile, hasProfile: boolean, isActive: boolean): string {
  if (!hasProfile) {
    return GRANT_TEXT;
  }
  const texts = profile === 'admin' ? ACTION_TEXTS.admin : ACTION_TEXTS.other;
  return isActive ? texts.active : texts.inactive;
}

// Lo que se puede hacer con cada perfil: concederlo si no lo tiene, habilitar
// o inhabilitar los de conductor y pasajero y dar o quitar el de
// administrador (salvo el propio). currentUserId: el administrador que mira
export function profileRows(detail: AdminUserDetail, currentUserId?: string): ProfileRow[] {
  const byProfile = new Map(detail.profiles.map((status) => [status.profile, status]));
  return (['driver', 'passenger', 'admin'] as const).map((profile) => {
    const hasProfile = byProfile.has(profile);
    const isActive = byProfile.get(profile)?.isActive ?? false;
    const isAdmin = profile === 'admin';
    return {
      profile,
      label: PROFILE_LABELS[profile],
      hasProfile,
      isActive,
      rating: isAdmin ? null : ratingLabel(detail.ratings[profile]),
      stateText: stateTextFor(hasProfile, isActive),
      actionText: actionTextFor(profile, hasProfile, isActive),
      canChange: !(isAdmin && detail.id === currentUserId),
    };
  });
}

// Texto de la confirmación de un cambio de perfil
export function profileMessage(row: ProfileRow, name: string): string {
  const isActive = !row.isActive;
  if (row.profile === 'admin') {
    return isActive
      ? `${name} podrá entrar en el panel de administración.`
      : `${name} dejará de tener acceso al panel de administración.`;
  }
  if (!row.hasProfile) {
    return row.profile === 'driver'
      ? `${name} podrá usar la app como conductor. Para publicar viajes tendrá que aceptar la declaración del conductor y registrar su vehículo.`
      : `${name} podrá usar la app como pasajero y pedir plaza en los viajes.`;
  }
  return isActive
    ? `${name} podrá volver a usar este perfil.`
    : `${name} no podrá usar este perfil y se cerrarán sus sesiones abiertas.`;
}

// Aviso al terminar: «Perfil de conductor concedido», «habilitado»…
export function profileToast(row: ProfileRow): string {
  const label = row.label.toLowerCase();
  if (!row.hasProfile) {
    return `Perfil de ${label} concedido.`;
  }
  if (row.profile === 'admin') {
    return `Perfil de ${label} ${row.isActive ? 'revocado' : 'concedido'}.`;
  }
  return `Perfil de ${label} ${row.isActive ? 'inhabilitado' : 'habilitado'}.`;
}
