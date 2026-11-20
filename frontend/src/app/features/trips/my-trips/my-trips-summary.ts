import { DriverTrip } from '../../../core/models/driver.model';

export type TripEnds = Pick<DriverTrip, 'originName' | 'destinationName'>;

// El origen y el destino por separado (sin nombres guardados, «Origen» y
// «Destino»), p. ej. uno debajo del otro en el aviso de «En curso»
export function routeEnds({ originName, destinationName }: TripEnds): {
  origin: string;
  destination: string;
} {
  return { origin: originName ?? 'Origen', destination: destinationName ?? 'Destino' };
}

// «Roquetas de Mar → Campus UAL · Parking P1 (Sur)» (sin nombres guardados,
// «Origen → Destino»)
export function formatRoute({
  originName,
  destinationName,
}: Pick<DriverTrip, 'originName' | 'destinationName'>): string {
  return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
}

// Las plazas ocupadas de un viaje del conductor
export function occupiedSeats({
  offeredSeats,
  availableSeats,
}: Pick<DriverTrip, 'offeredSeats' | 'availableSeats'>): number {
  return offeredSeats - availableSeats;
}
