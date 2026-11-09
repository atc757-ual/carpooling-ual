import { BusinessError } from '../../../shared/errors/business-error';

// La incidencia la está revisando otro administrador: solo él puede dejarla o
// atenderla. La capa API lo traduce a un 409 (INCIDENT_REVIEW_TAKEN)
export class IncidentReviewTakenError extends BusinessError {
  constructor(readonly incidentId: string) {
    super(
      'INCIDENT_REVIEW_TAKEN',
      'conflict',
      `The incident ${incidentId} is being reviewed by another administrator`,
    );
  }
}
