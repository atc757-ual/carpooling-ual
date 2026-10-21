import { ProfileType } from './profile-type';

// Datos públicos de un usuario (nunca el hash de la contraseña)
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  profiles: ProfileType[];
}
