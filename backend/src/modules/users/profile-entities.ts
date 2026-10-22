import { AdminProfile } from './entities/admin-profile.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { PassengerProfile } from './entities/passenger-profile.entity';

// Entidad (tabla) de cada perfil: cada uno se guarda en su propia tabla, en
// relación 1:1 con el usuario
export const PROFILE_ENTITIES = {
  driver: DriverProfile,
  passenger: PassengerProfile,
  admin: AdminProfile,
};
