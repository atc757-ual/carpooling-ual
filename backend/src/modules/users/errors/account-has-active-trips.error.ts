import { BusinessError } from '../../../shared/errors/business-error';

// No se puede eliminar la cuenta mientras tenga viajes sin terminar como
// conductor o plazas aceptadas como pasajero en viajes activos (409
// ACCOUNT_HAS_ACTIVE_TRIPS)
export class AccountHasActiveTripsError extends BusinessError {
  constructor() {
    super(
      'ACCOUNT_HAS_ACTIVE_TRIPS',
      'conflict',
      'Cancel or finish your active trips and accepted bookings before deleting your account',
    );
  }
}
