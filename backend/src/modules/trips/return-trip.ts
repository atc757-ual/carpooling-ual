import { BusinessError } from '../../shared/errors/business-error';
import { ReturnTripRejectedError } from './errors/return-trip-rejected.error';
import { DEFAULT_MAX_DETOUR_M } from './trip-timing';
import type { TripInput } from './trips.service';

// La vuelta que se publica con la ida (docs/diseno-modos-recogida-y-vuelta.md,
// §4.6): su hora de salida y sus plazas
export interface ReturnTripInput {
  departureAt: Date;
  offeredSeats: number;
}

// La vuelta es otro viaje con el origen y el destino al revés, el mismo
// vehículo y el mismo desvío. Recoge siempre en el camino: las paradas solo
// son de la ida al campus
export function toReturnTripInput(
  outbound: TripInput,
  returnTrip: ReturnTripInput,
): TripInput {
  return {
    vehicleId: outbound.vehicleId,
    origin: outbound.destination,
    destination: outbound.origin,
    originName: outbound.destinationName,
    destinationName: outbound.originName,
    departureAt: returnTrip.departureAt,
    offeredSeats: returnTrip.offeredSeats,
    maxDetourMin: outbound.maxDetourMin,
    pickupMode: 'on_route',
    maxDetourM:
      outbound.pickupMode === 'stops'
        ? DEFAULT_MAX_DETOUR_M
        : (outbound.maxDetourM ?? DEFAULT_MAX_DETOUR_M),
  };
}

// Lo que falla en la vuelta se dice como de la vuelta (RETURN_TRIP_REJECTED),
// para que quien publica sepa qué tramo cambiar
export async function asReturnLeg<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    throw error instanceof BusinessError
      ? new ReturnTripRejectedError(error)
      : error;
  }
}
