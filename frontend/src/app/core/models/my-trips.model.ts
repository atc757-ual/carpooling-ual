import { DriverTrip } from './driver.model';
import { SeatRequest } from './seat-request.model';

// Las pestañas de Tus viajes (?tab= de GET /users/me/trip-entries): por
// venir, hechos y no realizados
export type TripsTab = 'upcoming' | 'past' | 'cancelled';

// Una fila de Tus viajes: un viaje que conduce o una solicitud suya
export type TripEntryResponse =
  { role: 'driver'; trip: DriverTrip } | { role: 'passenger'; request: SeatRequest };

// Una página de Tus viajes con el total (X-Total-Count)
export interface TripEntryPage {
  items: TripEntryResponse[];
  total: number;
}

// Cuántas filas por página (los dos papeles juntos)
export const TRIP_ENTRIES_PAGE_SIZE = 10;

// GET /users/me/impact: lo ahorrado con los dos papeles
export interface UserImpact {
  tripsDone: number;
  driverKm: number;
  passengerKm: number;
  co2Kg: number;
}
