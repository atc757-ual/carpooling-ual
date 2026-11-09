import { BusinessError } from '../../../shared/errors/business-error';

// El administrador está implicado en el viaje de la incidencia (la registró,
// conduce el viaje o pidió plaza en él): la gestiona otro administrador
// (conflicto de intereses). La capa API lo traduce a un 403
// (INCIDENT_INVOLVED_ADMIN)
export class IncidentInvolvedAdminError extends BusinessError {
  constructor(readonly incidentId: string) {
    super(
      'INCIDENT_INVOLVED_ADMIN',
      'forbidden',
      `The administrator is involved in the incident ${incidentId}`,
    );
  }
}
