import { GeoPoint } from './place.model';
import { TripDirection } from './trip-search.model';
import { VehicleColor } from './driver.model';
import { AvatarKey } from './avatar.model';

// Cuerpo de POST /api/trips/search (matching)
export interface TripSearchRequest {
  place: GeoPoint;
  parkingId: string;
  direction: TripDirection;
  // Llegada al campus (al ir) o salida (al volver), en ISO 8601
  desiredAt: string;
  marginMin: number;
  seats: number;
}

// Un viaje compatible (recurso TripMatch de la API), del más compatible al
// menos
export interface TripMatch {
  id: string;
  driver: { id: string; name: string; avatarKey: AvatarKey | null };
  departureAt: string;
  // Llegada con el desvío para recoger o dejar al pasajero
  arrivalAt: string;
  availableSeats: number;
  detourMin: number;
  // Diferencia con la hora deseada, en minutos (negativa si es antes)
  timeDifferenceMin: number;
  // De 0 a 1
  score: number;
  vehicle: { brand: string | null; model: string | null; color: VehicleColor | null };
}
