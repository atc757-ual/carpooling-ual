import { SharedTrip } from '../../../core/models/trip-share.model';
import { formatPlate } from '../../../shared/utils/vehicle-display.util';
import { RoutePoint } from '../../../shared/components/ui/trip-route-map/trip-route-map';

// Sin posición nueva desde hace más de esto, se avisa de que no es en directo
export const STALE_POSITION_MS = 60_000;

export type SharedTripTone = 'info' | 'success' | 'neutral';

export interface SharedTripStatus {
  title: string;
  description: string;
  tone: SharedTripTone;
}

// El estado del pasajero en una frase, para quien sigue el viaje
export function describeSharedTrip(trip: SharedTrip, firstName: string): SharedTripStatus {
  if (trip.tripStatus === 'cancelled') {
    return {
      title: 'El viaje se ha cancelado',
      description: 'El viaje no se va a hacer: el pasajero buscará otra forma de llegar.',
      tone: 'neutral',
    };
  }
  if (trip.passengerState === 'finished') {
    return {
      title: 'El viaje ha terminado',
      description: `${firstName} ha llegado al destino.`,
      tone: 'success',
    };
  }
  if (trip.passengerState === 'on_board') {
    return {
      title: 'En el coche',
      description: 'El pasajero ya va en el coche, camino del destino.',
      tone: 'success',
    };
  }
  return {
    title: 'Esperando la recogida',
    description:
      trip.tripStatus === 'in_progress'
        ? 'El conductor ya ha salido y va hacia el punto de recogida.'
        : 'El viaje aún no ha empezado. Verás el coche en el mapa cuando salga.',
    tone: 'info',
  };
}

// «Seat Ibiza · Rojo · 1234 ABC», con lo que se sepa
export function describeSharedVehicle(vehicle: SharedTrip['vehicle']): string | null {
  if (vehicle === null) {
    return null;
  }
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
  const plate = vehicle.plate ? formatPlate(vehicle.plate) : null;
  const parts = [name, vehicle.colorName, plate].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// Los extremos del recorrido para el mapa (la salida y el destino son el
// principio y el final de la ruta)
export function routeEnds(
  route: NonNullable<SharedTrip['route']>,
  destinationName: string | null,
): { origin: RoutePoint; destination: RoutePoint } | null {
  const coordinates = route.coordinates;
  if (coordinates.length < 2) {
    return null;
  }
  return {
    origin: { coordinates: coordinates[0], label: 'Salida' },
    destination: {
      coordinates: coordinates.at(-1) ?? coordinates[0],
      label: destinationName ?? 'Destino',
    },
  };
}

export function isPositionStale(recordedAt: string, now: number): boolean {
  return now - Date.parse(recordedAt) > STALE_POSITION_MS;
}
