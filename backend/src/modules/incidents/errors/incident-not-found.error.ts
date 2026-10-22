import { BusinessError } from '../../../shared/errors/business-error';

// No existe la incidencia, o el usuario no es ni quien la registró ni un
// administrador (es privada: no se revela que existe, para proteger a quien
// informa de un problema con otra persona). La capa API lo traduce a un 404
// (INCIDENT_NOT_FOUND)
export class IncidentNotFoundError extends BusinessError {
  constructor(readonly incidentId: string) {
    super(
      'INCIDENT_NOT_FOUND',
      'not_found',
      `There is no incident with id ${incidentId}`,
    );
  }
}
