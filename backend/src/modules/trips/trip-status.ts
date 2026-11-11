import { InvalidTripTransitionError } from './errors/invalid-trip-transition.error';

// Estados del viaje (tipo trip_status de la migración inicial; RF-11)
export const TRIP_STATUSES = [
  'published',
  'confirmed',
  'in_progress',
  'finished',
  'cancelled',
  // Sin pasajeros al llegar el corte: se cierra solo (no es una cancelación)
  'expired',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

// Transiciones permitidas: el diagrama de estados del viaje de la memoria,
// en una única tabla. Cualquier otra se rechaza (RNF-10)
const ALLOWED_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  // aceptar una solicitud | cancelar | llegar al corte sin pasajeros
  published: ['confirmed', 'cancelled', 'expired'],
  // iniciar | cancelan todos los aceptados | cancelar
  confirmed: ['in_progress', 'published', 'cancelled'],
  // finalizar | cancelar durante el viaje, con incidencia (RF-23)
  in_progress: ['finished', 'cancelled'],
  // estados terminales
  finished: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TripStatus, to: TripStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTripTransitionError(from, to);
  }
}
