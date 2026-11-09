import type { IncidentStatus } from './entities/incident.entity';
import { InvalidIncidentTransitionError } from './errors/invalid-incident-transition.error';

// Transiciones de la revisión de una incidencia (CU-12), en una única tabla.
// Cualquier otra se rechaza (RNF-10)
const ALLOWED_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  // empezar la revisión
  open: ['in_review'],
  // dejar de revisarla | atenderla (con la resolución)
  in_review: ['open', 'reviewed'],
  // atendida: definitivo
  reviewed: [],
};

export function canTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidIncidentTransitionError(from, to);
  }
}
