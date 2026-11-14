import { TripResult } from '../../core/models/trip-result.model';
import { TripSearch } from '../../core/models/trip-search.model';
import { SeatRequestPickup } from '../../core/services/requests/seat-requests.service';
import { formatWalkingDistance } from '../../shared/utils/distance.util';

// Lo que se tarda en parar y subir (STOP_TIME_MIN del backend)
const PICKUP_STOP_MIN = 2;

// El dato «Recogida» del detalle: en paradas, la parada y su hora; si no, la
// hora de recogida o, sin ella, lo que tarda en recogerte (nunca 0 min: el
// desvío más lo que se tarda en parar y subir)
export function pickupFact(
  trip: Pick<TripResult, 'pickupDetourMinutes' | 'pickupTime' | 'pickupStop'>,
): string {
  const { pickupStop, pickupTime } = trip;
  if (pickupStop) {
    const at = pickupTime ? ` a las ${pickupTime}` : '';
    return `En la parada ${pickupStop.name}${at} (a ${formatWalkingDistance(pickupStop.walkingDistanceM)} andando)`;
  }
  if (pickupTime) {
    return `A las ${pickupTime}, en tu punto`;
  }
  return `unos ${trip.pickupDetourMinutes + PICKUP_STOP_MIN} min`;
}

// Dónde pide que le recojan: al volver, en el campus (no se envía nada); al
// ir, en la parada del conductor si recoge en paradas o, si no, en la
// dirección que buscó
export function toRequestPickup(
  search: Pick<TripSearch, 'direction' | 'place'>,
  trip: Pick<TripResult, 'pickupStop'>,
): SeatRequestPickup {
  if (search.direction === 'from-campus') {
    return { direction: search.direction };
  }
  if (trip.pickupStop) {
    return { direction: search.direction, stopId: trip.pickupStop.id };
  }
  return {
    direction: search.direction,
    location: { type: 'Point', coordinates: search.place.coordinates },
    name: search.place.name,
  };
}
