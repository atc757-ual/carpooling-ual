import { AdminEventSummary } from './admin-event.model';
import { TripStatus } from './driver.model';

// Viajes en el panel de administración (GET /api/admin/trips), solo lectura
export const ADMIN_TRIP_STATUSES: readonly TripStatus[] = [
  'published',
  'confirmed',
  'in_progress',
  'finished',
  'cancelled',
];

export interface AdminTripRow {
  id: string;
  href: string;
  status: TripStatus;
  departureAt: string;
  originName: string | null;
  destinationName: string | null;
  driver: { id: string; name: string | null };
  offeredSeats: number;
  availableSeats: number;
  requests: { pending: number; accepted: number };
}

export interface AdminTripQuery {
  status?: TripStatus;
  // Días de salida, YYYY-MM-DD en la hora del campus (los dos incluidos)
  from?: string;
  to?: string;
  // Nombre o correo del conductor
  driver?: string;
  offset: number;
  limit: number;
}

export interface AdminTripRequest {
  id: string;
  href: string;
  status: string;
  passenger: { id: string; name: string | null };
  seats: number;
  isPriority: boolean;
  pickupName: string | null;
  pickupAt: string | null;
  requestedAt: string;
}

// El detalle: sus solicitudes (las prioritarias primero) y los eventos del
// viaje y de sus solicitudes, en orden y sin el payload
export interface AdminTripDetail extends AdminTripRow {
  seatRequests: AdminTripRequest[];
  timeline: AdminEventSummary[];
}
