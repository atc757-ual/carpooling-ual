import { InvalidRequestTransitionError } from './errors/invalid-request-transition.error';

// Estados de la solicitud de plaza (tipo request_status de la migración
// inicial; RF-08, RF-09)
export const REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

// Transiciones permitidas: el diagrama de estados de la solicitud de la
// memoria, en una única tabla. Cualquier otra se rechaza (RNF-10). Una
// solicitud aceptada "termina" cuando termina el viaje, sin cambiar de estado
const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  // el conductor acepta | el conductor rechaza | el pasajero cancela | caduca por falta de respuesta
  pending: ['accepted', 'rejected', 'cancelled', 'expired'],
  // el pasajero cancela (devuelve la plaza) o el conductor marca no presentado
  accepted: ['cancelled'],
  // estados terminales
  rejected: [],
  cancelled: [],
  expired: [],
};

// Solicitudes "vivas": ocupan o pueden ocupar una plaza
export const LIVE_REQUEST_STATUSES: readonly RequestStatus[] = [
  'pending',
  'accepted',
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
