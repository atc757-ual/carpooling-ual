import { InvalidRequestTransitionError } from './errors/invalid-request-transition.error';

// Estados de la solicitud de plaza (tipo request_status de la migración
// inicial; RF-08, RF-09)
export const REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
  // El pasajero se ha bajado: su viaje ha terminado (cierre por pasajero)
  'completed',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

// Quién marcó la bajada de una plaza
export const DROP_OFF_ACTORS = ['driver', 'passenger', 'system'] as const;
export type DropOffActor = (typeof DROP_OFF_ACTORS)[number];

// Transiciones permitidas: el diagrama de estados de la solicitud de la
// memoria, en una única tabla. Cualquier otra se rechaza (RNF-10)
const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  // el conductor acepta | el conductor rechaza | el pasajero cancela | caduca por falta de respuesta
  pending: ['accepted', 'rejected', 'cancelled', 'expired'],
  // el pasajero cancela (devuelve la plaza), el conductor marca no presentado
  // o se baja del coche («Ha bajado», «He llegado» o al terminar el viaje)
  accepted: ['cancelled', 'completed'],
  // estados terminales
  rejected: [],
  cancelled: [],
  expired: [],
  completed: [],
};

// Solicitudes "vivas": ocupan o pueden ocupar una plaza
export const LIVE_REQUEST_STATUSES: readonly RequestStatus[] = [
  'pending',
  'accepted',
];

// Plazas de quien viaja o viajó en el viaje: el chat, la reseña (RF-22) y la
// posición del conductor siguen igual al bajarse
export const PARTICIPANT_REQUEST_STATUSES: readonly RequestStatus[] = [
  'accepted',
  'completed',
];

export function canRequestTransition(
  from: RequestStatus,
  to: RequestStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertRequestTransition(
  from: RequestStatus,
  to: RequestStatus,
): void {
  if (!canRequestTransition(from, to)) {
    throw new InvalidRequestTransitionError(from, to);
  }
}
