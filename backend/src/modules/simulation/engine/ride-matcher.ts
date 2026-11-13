import { MatchCandidate, scoreCandidates } from '../../matching/compatibility';
import { fitsBudget, usedDetourMin } from '../../trips/pickup-plan';
import type { Commuter, Driver, PlanePoint } from './population';
import { atMinute } from './twin-feed';

// Distancia por carretera ≈ línea recta × 1,3 (como trip-impact.ts del
// frontend) a 40 km/h de media. El desvío máximo es el presupuesto TOTAL del
// viaje (reunión con el director del 12/11/2026): los desvíos y las paradas
// (STOP_TIME_MIN cada una) de todos sus pasajeros caben en 10 min, como en la
// plataforma (trips/pickup-plan.ts)
export const DETOUR_FACTOR = 1.3;
export const SPEED_KMH = 40;
export const MAX_DETOUR_MIN = 10;
const CAMPUS: PlanePoint = { x: 0, y: 0 };
// Un pasajero a menos de esto de la salida del conductor no es una parada
const SAME_PLACE_KM = 0.05;

// Un conductor, sus plazas y sus recogidas (en orden) en una réplica
export interface RideOffer {
  driver: Driver;
  free: number;
  isCancelled: boolean;
  passengerIds: string[];
  pickups: PlanePoint[];
}

export function travelMin(from: PlanePoint, to: PlanePoint): number {
  const km = Math.hypot(from.x - to.x, from.y - to.y) * DETOUR_FACTOR;
  return (km / SPEED_KMH) * 60;
}

function routeMin(points: readonly PlanePoint[]): number {
  return points
    .slice(1)
    .reduce(
      (total, point, index) => total + travelMin(points[index], point),
      0,
    );
}

function isStop(driver: Driver, point: PlanePoint): boolean {
  return (
    Math.hypot(point.x - driver.origin.x, point.y - driver.origin.y) >
    SAME_PLACE_KM
  );
}

// Dónde meter la recogida en la ruta para que alargue lo menos posible
function cheapestInsertion(
  offer: RideOffer,
  point: PlanePoint,
): { index: number; pickups: PlanePoint[] } {
  let best = {
    index: 0,
    pickups: [point, ...offer.pickups],
    minutes: Infinity,
  };
  for (let index = 0; index <= offer.pickups.length; index++) {
    const pickups = [
      ...offer.pickups.slice(0, index),
      point,
      ...offer.pickups.slice(index),
    ];
    const minutes = routeMin([offer.driver.origin, ...pickups, CAMPUS]);
    if (minutes < best.minutes) {
      best = { index, pickups, minutes };
    }
  }
  return best;
}

// Desvío de todo el viaje si también recoge en este punto
export function detourWith(offer: RideOffer, point: PlanePoint): number {
  const { pickups } = cheapestInsertion(offer, point);
  const { driver } = offer;
  return usedDetourMin({
    durationMin: routeMin([driver.origin, ...pickups, CAMPUS]),
    directDurationMin: travelMin(driver.origin, CAMPUS),
    stops: pickups.filter((pickup) => isStop(driver, pickup)).length,
  });
}

// El conductor recoge también en este punto (donde menos alarga la ruta)
export function addPickup(offer: RideOffer, point: PlanePoint): void {
  offer.pickups = cheapestInsertion(offer, point).pickups;
}

interface OfferCandidate extends MatchCandidate {
  offer: RideOffer;
}

// El conductor sale para llegar a su hora por la ruta directa; el desvío es
// el de todo el viaje con este pasajero y los que ya lleva
function toCandidate(offer: RideOffer, passenger: Commuter): OfferCandidate {
  const { driver } = offer;
  const durationMin = travelMin(driver.origin, CAMPUS);
  return {
    offer,
    tripId: driver.id,
    departureAt: atMinute(driver.desiredArrivalMin - durationMin),
    durationMin,
    detourMin: detourWith(offer, passenger.origin),
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
    .map((offer) => toCandidate(offer, passenger))
    .filter(({ detourMin }) => fitsBudget(detourMin, MAX_DETOUR_MIN));
  const [best] = scoreCandidates(candidates, {
    desiredAt: atMinute(passenger.desiredArrivalMin),
    timeReference: 'arrival',
    marginMin: passenger.windowMin,
    seats: 1,
  });
  return best?.candidate.offer ?? null;
}
