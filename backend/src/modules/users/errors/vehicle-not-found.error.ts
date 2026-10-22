import { BusinessError } from '../../../shared/errors/business-error';

// No existe un vehículo activo con ese id ENTRE LOS DEL CONDUCTOR. Un vehículo
// de otro conductor también da este error, para no revelar qué ids existen.
// La capa API lo traduce a un 404 (VEHICLE_NOT_FOUND)
export class VehicleNotFoundError extends BusinessError {
  constructor(readonly vehicleId: string) {
    super(
      'VEHICLE_NOT_FOUND',
      'not_found',
      `There is no vehicle with id ${vehicleId}`,
    );
  }
}
