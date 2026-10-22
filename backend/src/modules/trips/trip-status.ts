import { InvalidTripTransitionError } from './errors/invalid-trip-transition.error';

// Estados del viaje (tipo trip_status de la migración inicial; RF-11)
export const TRIP_STATUSES = [
  'published',
  'confirmed',
  'in_progress',
  'finished',
  'cancelled',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

// Transiciones permitidas: el diagrama de estados del viaje de la memoria,
// en una única tabla. Cualquier otra se rechaza (RNF-10)
const ALLOWED_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  // aceptar una solicitud | cancelar
  published: ['confirmed', 'cancelled'],
  // iniciar | cancelan todos los aceptados | cancelar
  confirmed: ['in_progress', 'published', 'cancelled'],
  // finalizar | cancelar durante el viaje, con incidencia (RF-23)
  in_progress: ['finished', 'cancelled'],
  // estados terminales
  finished: [],
  cancelled: [],
};

export function canTransition(from: TripStatus, to: TripStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TripStatus, to: TripStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTripTransitionError(from, to);
  }
}
