import { ProfileType, RegistrableProfile } from './profile-type';
import { AvatarKey, TravelPreferences } from './travel-preferences';

// La media por rol solo se muestra a partir de 3 reseñas publicadas; con menos
// se indica «Nuevo conductor» o «Nuevo pasajero» (RF-22)
export const MIN_RATINGS_FOR_AVERAGE = 3;

export interface RoleRatingSummary {
  averageRating: number | null;
  ratingCount: number;
}

export interface UserRatingsSummary {
  driver: RoleRatingSummary;
  passenger: RoleRatingSummary;
}

export function toRoleRatingSummary(
  profile?: { averageRating?: number | null; ratingCount?: number } | null,
): RoleRatingSummary {
  const ratingCount = profile?.ratingCount ?? 0;
  return {
    averageRating:
      ratingCount >= MIN_RATINGS_FOR_AVERAGE
        ? (profile?.averageRating ?? null)
        : null,
    ratingCount,
  };
}

export function toUserRatingsSummary(user: {
  driverProfile?: {
    averageRating?: number | null;
    ratingCount?: number;
  } | null;
  passengerProfile?: {
    averageRating?: number | null;
    ratingCount?: number;
  } | null;
}): UserRatingsSummary {
  return {
    driver: toRoleRatingSummary(user.driverProfile),
    passenger: toRoleRatingSummary(user.passengerProfile),
  };
}

// Lo que ven los demás usuarios de un conductor o un pasajero (detalle del
// viaje, resultados de búsqueda y solicitudes de plaza)
export interface PublicUserProfile {
  id: string;
  name: string;
  avatarKey: AvatarKey | null;
  preferences: TravelPreferences;
}

// Datos de la cuenta de un usuario (nunca el hash de la contraseña). Solo se
// devuelven al propio usuario (registro, login, /me, su GET /api/users/{id})
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  // NULL en quien no pasó por el registro público (administrador inicial, seed)
  phone: string | null;
  phoneVerified: boolean;
  profiles: ProfileType[];
  // NULL hasta que elige con qué modo viaja (ver User.activeMode)
  activeMode: RegistrableProfile | null;
  // Margen horario por defecto de sus búsquedas, en minutos
  timeToleranceMin: number;
  avatarKey: AvatarKey | null;
  bio: string | null;
  preferences: TravelPreferences;
  ratings: UserRatingsSummary;
}
