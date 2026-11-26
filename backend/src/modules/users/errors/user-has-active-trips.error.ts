import { BusinessError } from '../../../shared/errors/business-error';

// Un administrador no puede inhabilitar la cuenta mientras el usuario tenga
// viajes sin terminar como conductor o plazas aceptadas como pasajero: lo
// mismo que su baja (ACCOUNT_HAS_ACTIVE_TRIPS), pero dicho al administrador
// (409 USER_HAS_ACTIVE_TRIPS)
export class UserHasActiveTripsError extends BusinessError {
  constructor() {
    super(
      'USER_HAS_ACTIVE_TRIPS',
      'conflict',
      'The user has unfinished trips or accepted seats: wait until they end or are cancelled',
    );
  }
}
