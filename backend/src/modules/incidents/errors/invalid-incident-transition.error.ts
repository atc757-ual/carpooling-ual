import { BusinessError } from '../../../shared/errors/business-error';
import type { IncidentStatus } from '../entities/incident.entity';

// Un cambio de estado que la revisión no permite (p. ej. atender una
// incidencia sin haber empezado a revisarla). La capa API lo traduce a un 409
// (INCIDENT_INVALID_TRANSITION)
export class InvalidIncidentTransitionError extends BusinessError {
  constructor(
    readonly from: IncidentStatus,
    readonly to: IncidentStatus,
  ) {
    super(
      'INCIDENT_INVALID_TRANSITION',
      'conflict',
      `An incident cannot go from ${from} to ${to}`,
    );
  }
}
