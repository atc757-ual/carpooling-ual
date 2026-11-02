// Usuario de la plataforma tal como lo devuelve la API (recurso TMF630 User)
import { TimeToleranceMin, TravelPreferences } from './travel-preferences.model';

export type Profile = 'driver' | 'passenger' | 'admin';

export interface RoleRating {
  averageRating: number | null;
  ratingCount: number;
}

export interface UserRatings {
  driver: RoleRating;
  passenger: RoleRating;
}

export interface User {
  '@type': 'User';
  id: string;
  href: string;
  name: string;
  email: string;
  // Formato internacional (+34600123456); null en quien no pasó por el
  // registro (administrador inicial)
  phone: string | null;
  phoneVerified?: boolean;
  profiles: Profile[];
  // Modo con el que viaja ahora, el mismo en todos sus dispositivos; null
  // hasta que lo cambia por primera vez
  activeMode: 'passenger' | 'driver' | null;
  timeToleranceMin?: number;
  avatarKey?: string | null;
  bio?: string | null;
  preferences?: TravelPreferences;
  ratings?: UserRatings;
}

// Cuerpo de PATCH /api/users/me
export interface UpdateMeRequest {
  name?: string;
  phone?: string;
  timeToleranceMin?: TimeToleranceMin;
  avatarKey?: string | null;
  bio?: string | null;
  preferences?: Partial<TravelPreferences>;
}
