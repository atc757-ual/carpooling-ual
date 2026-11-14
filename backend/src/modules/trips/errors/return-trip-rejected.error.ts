import { BusinessError } from '../../../shared/errors/business-error';

// Al publicar la ida y la vuelta a la vez, la vuelta no cumple una regla (se
// cruza con otro viaje, sale demasiado pronto, pasa de las plazas…): no se
// publica ninguna. Guarda el error de la vuelta (cause) y su tipo de fallo,
// así que la capa API lo traduce a su mismo status (RETURN_TRIP_REJECTED)
export class ReturnTripRejectedError extends BusinessError {
  constructor(readonly cause: BusinessError) {
    super(
      'RETURN_TRIP_REJECTED',
      cause.kind,
      `Return trip (${cause.code}): ${cause.message}`,
    );
  }
}
