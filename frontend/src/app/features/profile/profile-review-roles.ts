import { translate } from '@jsverse/transloco';
import { carOutline, personOutline } from 'ionicons/icons';
import { ReviewTargetRole } from '../../core/services/users/trip-reviews.service';

// Cómo se llama y qué icono lleva cada papel en las reseñas de Mi perfil (la
// tarjeta «Reseñas» y las pestañas de «Tus reseñas»): el coche para el
// conductor y la persona para el pasajero
export function reviewRoleLabel(role: ReviewTargetRole): string {
  return translate(
    role === 'driver' ? 'screens.profile.roleDriver' : 'screens.profile.rolePassenger',
  );
}

export function reviewRoleIcon(role: ReviewTargetRole): string {
  return role === 'driver' ? carOutline : personOutline;
}
