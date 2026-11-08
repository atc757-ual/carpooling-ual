import { AdminTripRow } from '../../../core/models/admin-trip.model';
import { TripStatus } from '../../../core/models/driver.model';

// Textos de los viajes en el panel. Funciones puras para probarlas sin
// pantalla (el estado, el trayecto y las fechas, en admin-user-detail-labels)

// El tono del chip de cada estado (el texto siempre dice el estado; el color
// acompaña). Sin tono: gris
const STATUS_TONES: Partial<Record<TripStatus, string>> = {
  published: 'info',
  confirmed: 'accepted',
  in_progress: 'pending',
};

export function tripStatusClass(status: TripStatus): string {
  const tone = STATUS_TONES[status];
  return tone ? `status status--${tone}` : 'status';
}

// «2 de 3 libres»
export function seatsLabel(trip: Pick<AdminTripRow, 'availableSeats' | 'offeredSeats'>): string {
  return `${trip.availableSeats} de ${trip.offeredSeats} libres`;
}

// «1 aceptada · 2 pendientes»; sin ninguna, «Sin solicitudes»
export function requestsLabel({ requests }: Pick<AdminTripRow, 'requests'>): string {
  const parts = [
    plural(requests.accepted, 'aceptada', 'aceptadas'),
    plural(requests.pending, 'pendiente', 'pendientes'),
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(' · ') : 'Sin solicitudes';
}

function plural(count: number, one: string, many: string): string | null {
  if (count === 0) {
    return null;
  }
  return `${count} ${count === 1 ? one : many}`;
}

// «7,8 km · 11 min»; desde una hora, «42 km · 1 h 5 min»
export function routeSummaryLabel(route: { distanceKm: number; durationMin: number }): string {
  const distance = route.distanceKm.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return `${distance} km · ${durationLabel(Math.round(route.durationMin))}`;
}

function durationLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const rest = minutes % 60;
  const hours = `${Math.floor(minutes / 60)} h`;
  return rest === 0 ? hours : `${hours} ${rest} min`;
}
