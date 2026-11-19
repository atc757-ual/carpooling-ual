import { DriverTrip } from '../../../core/models/driver.model';

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
