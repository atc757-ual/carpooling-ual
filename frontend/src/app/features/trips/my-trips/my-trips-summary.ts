import { DriverTrip } from '../../../core/models/driver.model';
import { estimateTripImpact } from '../../matching/trip-impact';

// «Roquetas de Mar → Campus UAL · Parking P1 (Sur)» (sin nombres guardados,
// «Origen → Destino»)
export function formatRoute({
  originName,
  destinationName,
}: Pick<DriverTrip, 'originName' | 'destinationName'>): string {
  return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
}

export interface SharedTrip extends Pick<DriverTrip, 'origin' | 'destination'> {
  // Los coches que no salieron gracias al viaje: uno por plaza ocupada (el
  // conductor) o uno (el pasajero, que no llevó el suyo)
  carsAvoided: number;
}

// El CO₂ que se ha dejado de emitir en los viajes hechos (estimado, con los
// mismos valores de ejemplo que Buscar y Publicar)
export function savedCo2Kg(trips: readonly SharedTrip[]): number {
  const total = trips.reduce(
    (sum, { origin, destination, carsAvoided }) =>
      sum +
      (estimateTripImpact(origin.coordinates, destination.coordinates)?.co2Kg ?? 0) * carsAvoided,
    0,
  );
  return Math.round(total * 10) / 10;
}

// Las plazas ocupadas de un viaje del conductor
export function occupiedSeats({
  offeredSeats,
  availableSeats,
}: Pick<DriverTrip, 'offeredSeats' | 'availableSeats'>): number {
  return offeredSeats - availableSeats;
}
