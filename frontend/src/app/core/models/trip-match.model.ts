import { GeoPoint } from './place.model';
import { TripDirection } from './trip-search.model';
import { TravelPreferences } from './travel-preferences.model';

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
  driver: {
    id: string;
    name: string;
    avatarKey: string | null;
    preferences?: TravelPreferences;
    tripCount: number;
    rating: number | null;
  };
  departureAt: string;
  // Llegada con el desvío para recoger o dejar al pasajero
  arrivalAt: string;
  availableSeats: number;
  detourMin: number;
  // Hacia el campus, a qué hora le recogería (ISO 8601); null al volver
  pickupAt: string | null;
  // Si el conductor recoge en paradas: la más cercana, donde le recoge
  stop: TripMatchStop | null;
  // Diferencia con la hora deseada, en minutos (negativa si es antes)
  timeDifferenceMin: number;
  // De 0 a 1
  score: number;
  vehicle: { brand: string | null; model: string | null; color: string | null };
}

export interface TripMatchStop {
  id: string;
  name: string;
  location: GeoPoint;
  // En línea recta desde la dirección buscada
  walkingDistanceM: number;
}
