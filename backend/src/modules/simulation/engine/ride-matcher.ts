import { MatchCandidate, scoreCandidates } from '../../matching/compatibility';
import { fitsBudget, usedDetourMin } from '../../trips/pickup-plan';
import {
  MAX_TRIP_STOPS,
  PICKUP_RADIUS_M,
  WALK_RADIUS_M,
} from '../../trips/trip-timing';
import type { Commuter, Driver, PlanePoint } from './population';
import { atMinute } from './twin-feed';

// Distancia por carretera ≈ línea recta × 1,3 (como trip-impact.ts del
// frontend) a 40 km/h de media. El desvío máximo es el presupuesto TOTAL del
// viaje: los desvíos y las paradas
// (STOP_TIME_MIN cada una) de todos sus pasajeros caben en 10 min, como en la
// plataforma (trips/pickup-plan.ts)
export const DETOUR_FACTOR = 1.3;
export const SPEED_KMH = 40;
export const MAX_DETOUR_MIN = 10;
const CAMPUS: PlanePoint = { x: 0, y: 0 };
// Un pasajero a menos de esto de la salida del conductor no es una parada
const SAME_PLACE_KM = 0.05;
const METERS_PER_KM = 1000;

// Ida al campus (por la mañana) o vuelta desde el campus (por la tarde)
export type Leg = 'to-campus' | 'from-campus';
// Cómo recoge el conductor (trips.pickup_mode): por el camino o en paradas
export type PickupMode = 'on_route' | 'stops';

// Un conductor, sus plazas y sus recogidas (en orden) en un tramo de una
// réplica. Con paradas, las de su ruta (la salida y las demás)
export interface RideOffer {
  driver: Driver;
  leg: Leg;
  pickupMode: PickupMode;
  // Por el camino: cuánto se aparta de su ruta para recoger (max_detour_m)
  maxDetourM: number;
  stops: PlanePoint[];
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

function distanceKm(a: PlanePoint, b: PlanePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Distancia de un punto a la ruta del conductor (en línea recta entre su
// salida y el campus), en km
export function distanceToRouteKm(driver: Driver, point: PlanePoint): number {
  const { origin } = driver;
  const dx = CAMPUS.x - origin.x;
  const dy = CAMPUS.y - origin.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return distanceKm(origin, point);
  }
  const along = Math.min(
    1,
    Math.max(
      0,
      ((point.x - origin.x) * dx + (point.y - origin.y) * dy) / lengthSquared,
    ),
  );
  return distanceKm(point, {
    x: origin.x + along * dx,
    y: origin.y + along * dy,
  });
}

// Las paradas de un conductor que recoge en paradas: su salida y las demás
// repartidas por la ruta hacia el campus (MAX_TRIP_STOPS en total, como en la
// plataforma)
export function stopsOf(driver: Driver): PlanePoint[] {
  const { origin } = driver;
  return Array.from({ length: MAX_TRIP_STOPS }, (_, index) => {
    const along = index / MAX_TRIP_STOPS;
    return { x: origin.x * (1 - along), y: origin.y * (1 - along) };
  });
}

function isStop(driver: Driver, point: PlanePoint): boolean {
  return distanceKm(point, driver.origin) > SAME_PLACE_KM;
}

// Dónde meter la recogida en la ruta para que alargue lo menos posible. La
// vuelta recorre la misma ruta al revés (dejando a cada pasajero): el tiempo
// es el mismo
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

// Desvío de todo el viaje si también recoge (o deja) en este punto
export function detourWith(offer: RideOffer, point: PlanePoint): number {
  const { pickups } = cheapestInsertion(offer, point);
  const { driver } = offer;
  return usedDetourMin({
    durationMin: routeMin([driver.origin, ...pickups, CAMPUS]),
    directDurationMin: travelMin(driver.origin, CAMPUS),
    stops: pickups.filter((pickup) => isStop(driver, pickup)).length,
  });
}

// Dónde sube (o baja) el pasajero en este viaje, o null si no le pilla, con
// las reglas de la plataforma (trips/trip-candidates.service.ts): a la ida,
// con paradas, una a menos de WALK_RADIUS_M a pie; por el camino, a menos de
// lo que se aparta el conductor (max_detour_m); a la vuelta, siempre por el
// camino, a menos de PICKUP_RADIUS_M de la ruta
export function meetingPointOf(
  offer: RideOffer,
  passenger: Commuter,
): PlanePoint | null {
  const { origin } = passenger;
  if (offer.leg === 'to-campus' && offer.pickupMode === 'stops') {
    // La más cercana a pie; sin paradas, ninguna
    const nearest = offer.stops.reduce<PlanePoint | null>(
      (best, stop) =>
        best === null || distanceKm(stop, origin) < distanceKm(best, origin)
          ? stop
          : best,
      null,
    );
    return nearest !== null &&
      distanceKm(nearest, origin) * METERS_PER_KM <= WALK_RADIUS_M
      ? nearest
      : null;
  }
  const radiusM =
    offer.leg === 'to-campus' ? offer.maxDetourM : PICKUP_RADIUS_M;
  return distanceToRouteKm(offer.driver, origin) * METERS_PER_KM <= radiusM
    ? origin
    : null;
}

// El conductor recoge (o deja) también en este punto, donde menos alarga
export function addPickup(offer: RideOffer, point: PlanePoint): void {
  offer.pickups = cheapestInsertion(offer, point).pickups;
}

interface OfferCandidate extends MatchCandidate {
  offer: RideOffer;
  meetingPoint: PlanePoint;
}

// A la ida, el conductor sale para llegar a su hora por la ruta directa; a la
// vuelta, sale del campus a la suya. El desvío es el de todo el viaje con
// este pasajero y los que ya lleva
function toCandidate(
  offer: RideOffer,
  meetingPoint: PlanePoint,
): OfferCandidate {
  const { driver } = offer;
  const durationMin = travelMin(driver.origin, CAMPUS);
  const departureMin =
    offer.leg === 'to-campus'
      ? driver.desiredArrivalMin - durationMin
      : driver.desiredDepartureMin;
  return {
    offer,
    meetingPoint,
    tripId: driver.id,
    departureAt: atMinute(departureMin),
    durationMin,
    detourMin: detourWith(offer, meetingPoint),
    maxDetourMin: MAX_DETOUR_MIN,
    availableSeats: offer.free,
  };
}

export interface RideMatch {
  offer: RideOffer;
  // Donde sube a la ida (su origen o una parada) o baja a la vuelta
  meetingPoint: PlanePoint;
}

// El mejor viaje para un pasajero con la misma puntuación pura que usa la
// plataforma (matching/compatibility.ts), o null si ninguno encaja. A la ida
// cuenta la hora de llegada; a la vuelta, la de salida del campus
export function findRide(
  passenger: Commuter,
  offers: readonly RideOffer[],
): RideMatch | null {
  const candidates = offers
    .filter((offer) => !offer.isCancelled && offer.free > 0)
    .flatMap((offer) => {
      const meetingPoint = meetingPointOf(offer, passenger);
      return meetingPoint === null ? [] : [toCandidate(offer, meetingPoint)];
    })
    .filter(({ detourMin }) => fitsBudget(detourMin, MAX_DETOUR_MIN));
  const isToCampus = offers[0]?.leg !== 'from-campus';
  const [best] = scoreCandidates(candidates, {
    desiredAt: atMinute(
      isToCampus ? passenger.desiredArrivalMin : passenger.desiredDepartureMin,
    ),
    timeReference: isToCampus ? 'arrival' : 'departure',
    marginMin: passenger.windowMin,
    seats: 1,
  });
  return best
    ? { offer: best.candidate.offer, meetingPoint: best.candidate.meetingPoint }
    : null;
}
