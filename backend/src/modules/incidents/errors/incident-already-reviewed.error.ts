import { BusinessError } from '../../../shared/errors/business-error';

// La incidencia ya está revisada: la revisión es definitiva (CU-12, "revisada
// y cerrada"). La capa API lo traduce a un 409 (INCIDENT_ALREADY_REVIEWED)
export class IncidentAlreadyReviewedError extends BusinessError {
  constructor(readonly incidentId: string) {
    super(
      'INCIDENT_ALREADY_REVIEWED',
      'conflict',
      `The incident ${incidentId} has already been reviewed`,
    );
  }
}
