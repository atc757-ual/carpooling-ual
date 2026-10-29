import { BusinessError } from '../../../shared/errors/business-error';

// El conductor ya tiene el máximo de vehículos activos: para registrar otro,
// debe dar de baja uno. La capa API lo traduce a un 409
// (VEHICLE_LIMIT_REACHED)
export class VehicleLimitReachedError extends BusinessError {
  constructor(readonly limit: number) {
    super(
      'VEHICLE_LIMIT_REACHED',
      'conflict',
      `A driver can have at most ${limit} active vehicles`,
    );
  }
}
