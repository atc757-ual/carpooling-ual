import { translate } from '@jsverse/transloco';
import { DriverTrip, Trip, TripStatus } from '../../../core/models/driver.model';
import { TripsTab } from '../../../core/models/my-trips.model';
import { SeatRequest } from '../../../core/models/seat-request.model';

export type { TripsTab } from '../../../core/models/my-trips.model';

// Las pestañas de Tus viajes, una sola lista para el conductor y el pasajero.
// «No realizados» y no «Cancelados»: ahí caen también las solicitudes
// rechazadas y caducadas, que no canceló nadie
const TRIPS_TAB_VALUES: readonly TripsTab[] = ['upcoming', 'past', 'cancelled'];

// Las pestañas con su texto en el idioma activo
export function tripsTabs(): { value: TripsTab; label: string }[] {
  return TRIPS_TAB_VALUES.map((value) => ({
    value,
    label: translate(`labels.tripsTabs.${value}`),
  }));
}

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
  // Ya se bajó: su viaje terminó aunque el del conductor siga en curso
  if (request.status === 'completed') {
    return 'past';
  }
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
  return translate(`labels.requestStatus.${passengerRequestState(request, trip)}`);
}

function passengerRequestState(request: SeatRequest, trip: Trip): string {
  if (request.status === 'completed') {
    return 'done';
  }
  if (trip.status === 'cancelled') {
    return 'tripCancelled';
  }
  switch (request.status) {
    case 'pending':
      return 'pending';
    case 'accepted':
      return trip.status === 'finished' ? 'done' : 'confirmed';
    case 'rejected':
      return request.rejectionReason === 'trip_full' ? 'tripFull' : 'rejected';
    case 'expired':
      return 'expired';
    case 'cancelled':
      return request.rejectionReason === 'no_show' ? 'noShow' : 'cancelled';
  }
}

// La clave del vacío de cada pestaña
export function emptyTextKey(tab: TripsTab): string {
  return `labels.tripsEmpty.${tab}`;
}
