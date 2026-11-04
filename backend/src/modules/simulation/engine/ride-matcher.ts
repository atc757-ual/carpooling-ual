import { MatchCandidate, scoreCandidates } from '../../matching/compatibility';
import type { Commuter, Driver, PlanePoint } from './population';
import { atMinute } from './twin-feed';

// Distancia por carretera ≈ línea recta × 1,3 (como trip-impact.ts del
// frontend) a 40 km/h de media; desvío máximo por pasajero de 10 min
export const DETOUR_FACTOR = 1.3;
export const SPEED_KMH = 40;
export const MAX_DETOUR_MIN = 10;
const CAMPUS: PlanePoint = { x: 0, y: 0 };

// Un conductor y sus plazas en una réplica
export interface RideOffer {
  driver: Driver;
  free: number;
  isCancelled: boolean;
  passengerIds: string[];
}

export function travelMin(from: PlanePoint, to: PlanePoint): number {
  const km = Math.hypot(from.x - to.x, from.y - to.y) * DETOUR_FACTOR;
  return (km / SPEED_KMH) * 60;
}

interface OfferCandidate extends MatchCandidate {
  offer: RideOffer;
}

// El conductor sale para llegar a su hora; recoger al pasajero añade el
// desvío (conductor → pasajero → campus frente a conductor → campus)
function toCandidate(offer: RideOffer, passenger: Commuter): OfferCandidate {
  const { driver } = offer;
  const durationMin = travelMin(driver.origin, CAMPUS);
  const detourMin =
    travelMin(driver.origin, passenger.origin) +
    travelMin(passenger.origin, CAMPUS) -
    durationMin;
  return {
    offer,
    tripId: driver.id,
    departureAt: atMinute(driver.desiredArrivalMin - durationMin),
    durationMin,
    detourMin,
    maxDetourMin: MAX_DETOUR_MIN,
    availableSeats: offer.free,
  };
}

// El mejor viaje para un pasajero con la misma puntuación pura que usa la
// plataforma (matching/compatibility.ts), o null si ninguno encaja
export function findRide(
  passenger: Commuter,
  offers: readonly RideOffer[],
): RideOffer | null {
  const candidates = offers
    .filter((offer) => !offer.isCancelled && offer.free > 0)
    .map((offer) => toCandidate(offer, passenger));
  const [best] = scoreCandidates(candidates, {
    desiredAt: atMinute(passenger.desiredArrivalMin),
    timeReference: 'arrival',
    marginMin: passenger.windowMin,
    seats: 1,
  });
  return best?.candidate.offer ?? null;
}
