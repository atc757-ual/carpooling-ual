import { DriverTrip, Trip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';

// Las pestañas de Mis viajes, iguales para el conductor y el pasajero
export type TripsTab = 'upcoming' | 'past' | 'cancelled';

export const TRIPS_TABS: readonly { value: TripsTab; label: string }[] = [
  { value: 'upcoming', label: 'Próximos' },
  { value: 'past', label: 'Anteriores' },
  { value: 'cancelled', label: 'Cancelados' },
];

// Viajes que aún no han terminado: publicados, confirmados y en curso
const ACTIVE_TRIPS: ReadonlySet<TripStatus> = new Set(['published', 'confirmed', 'in_progress']);

export function isTripsTab(value: unknown): value is TripsTab {
  return value === 'upcoming' || value === 'past' || value === 'cancelled';
}

// El conductor: próximos los que no han terminado, anteriores los
// finalizados y cancelados los cancelados
export function driverTripTab({ status }: DriverTrip): TripsTab {
  if (ACTIVE_TRIPS.has(status)) {
    return 'upcoming';
  }
  return status === 'finished' ? 'past' : 'cancelled';
}

// El pasajero: próximas sus solicitudes pendientes o aceptadas de viajes que
// no han terminado; anteriores las aceptadas de viajes finalizados; y en
// Cancelados todo lo demás (no aceptadas, caducadas, canceladas por él o por
// no presentarse y las de viajes cancelados)
export function passengerTripTab(request: SeatRequest, trip: Trip): TripsTab {
  const isActive = request.status === 'pending' || request.status === 'accepted';
  if (isActive && ACTIVE_TRIPS.has(trip.status)) {
    return 'upcoming';
  }
  if (request.status === 'accepted' && trip.status === 'finished') {
    return 'past';
  }
  return 'cancelled';
}

// La etiqueta de una solicitud del pasajero, con el motivo en Cancelados
export function passengerRequestLabel(request: SeatRequest, trip: Trip): string {
  if (trip.status === 'cancelled') {
    return 'Viaje cancelado';
  }
  switch (request.status) {
    case 'pending':
      return 'Pendiente';
    case 'accepted':
      return trip.status === 'finished' ? 'Realizado' : 'Confirmada';
    case 'rejected':
      return request.rejectionReason === 'trip_full' ? 'Viaje completo' : 'No aceptada';
    case 'expired':
      return 'Caducada';
    case 'cancelled':
      return request.rejectionReason === 'no_show' ? 'No te presentaste' : 'Cancelada';
  }
}

// El vacío de cada pestaña
export const EMPTY_TEXTS: Readonly<Record<TripsTab, string>> = {
  upcoming: 'No tienes viajes programados',
  past: 'Aún no has hecho ningún viaje',
  cancelled: 'No tienes viajes cancelados',
};
