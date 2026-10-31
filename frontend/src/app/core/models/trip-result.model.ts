// Un viaje que encaja con la búsqueda del pasajero (resultados de Buscar)

// Los viajes hechos y la valoración aún no los da la API (reputación,
// RF-22): sin ellos no se muestran
import { VehicleColor } from './driver.model';
import { TripDirection } from './trip-search.model';
import { AvatarKey } from './avatar.model';

export interface TripDriver {
  name: string;
  avatarKey: AvatarKey | null;
  tripCount?: number;
  // De 0 a 5
  rating?: number;
  isEmailVerified: boolean;
}

export interface TripResult {
  id: string;
  direction: TripDirection;
  // ISO 8601, para ordenar correctamente aunque la llegada pase de día
  arrivalAt: string;
  // HH:MM
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  driver: TripDriver;
  freeSeats: number;
  // Minutos que se desvía el conductor para recoger al pasajero
  pickupDetourMinutes: number;
  // Dirección elegida por el pasajero; ya forma parte del estado de búsqueda
  passengerStop: string;
  // Sin la matrícula: solo la ve quien tiene la plaza aceptada (en su solicitud)
  vehicle?: { brand: string | null; model: string | null; color: VehicleColor | null };
}
