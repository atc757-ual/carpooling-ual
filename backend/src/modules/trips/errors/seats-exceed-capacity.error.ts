import { BusinessError } from '../../../shared/errors/business-error';

// RF-04: las plazas ofertadas no pueden superar la capacidad del vehículo (sus
// plazas para pasajeros). La capa API lo traduce a un 400
// (SEATS_EXCEED_CAPACITY)
export class SeatsExceedCapacityError extends BusinessError {
  constructor(
    readonly offeredSeats: number,
    readonly capacity: number,
  ) {
    super(
      'SEATS_EXCEED_CAPACITY',
      'invalid',
      `The trip offers ${offeredSeats} seats but the vehicle has ${capacity}`,
    );
  }
}
