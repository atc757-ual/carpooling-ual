import { TravelPreferences } from './travel-preferences.model';
import { UserRatings } from './user.model';

// GET /api/trips/{id}/participants/{userId}: lo que ven el uno del otro el
// conductor y cada pasajero con plaza (el teléfono no)
export interface ParticipantProfile {
  id: string;
  name: string;
  email: string;
  avatarKey: string | null;
  bio: string | null;
  preferences: TravelPreferences;
  ratings: UserRatings;
}

// GET /api/trips/{id}/participants: los demás pasajeros con plaza del viaje,
// solo con el nombre de pila y el avatar (su perfil no se abre)
export interface CoPassenger {
  id: string;
  name: string;
  avatarKey: string | null;
}
