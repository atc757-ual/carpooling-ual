import { ProfileType, RegistrableProfile } from './profile-type';

// Datos de la cuenta de un usuario (nunca el hash de la contraseña). Solo se
// devuelven al propio usuario (registro, login, /me, su GET /api/users/{id});
// los demás módulos solo usan el nombre (p. ej. el del conductor en un viaje)
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
}
