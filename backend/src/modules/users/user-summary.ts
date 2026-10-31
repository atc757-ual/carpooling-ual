import { ProfileType, RegistrableProfile } from './profile-type';
import { AvatarKey, TravelPreferences } from './travel-preferences';

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
  profiles: ProfileType[];
  // NULL hasta que elige con qué modo viaja (ver User.activeMode)
  activeMode: RegistrableProfile | null;
  // Margen horario por defecto de sus búsquedas, en minutos
  timeToleranceMin: number;
  avatarKey: AvatarKey | null;
  bio: string | null;
  preferences: TravelPreferences;
}
