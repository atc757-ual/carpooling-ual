import { BusinessError } from '../../../shared/errors/business-error';

// Hay viajes publicados, confirmados o en curso que van a ese parking (o salen
// de él): no se puede cerrar ni mover hasta que terminen. La capa API lo
// traduce a un 409 (PARKING_IN_USE)
export class ParkingInUseError extends BusinessError {
  constructor(
    readonly parkingId: string,
    readonly activeTrips: number,
  ) {
    super(
      'PARKING_IN_USE',
      'conflict',
      `The parking ${parkingId} has ${activeTrips} active trips`,
    );
  }
}
