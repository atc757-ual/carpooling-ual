import type { LineString, Point } from 'typeorm';
import { STOP_TIME_MIN } from './trip-timing';

// Cálculo puro de las recogidas de un viaje (sin base de datos ni OSRM): en
// qué orden se recoge, cuánto desvío se ha gastado y a qué hora llega a cada
// recogida. Lo usan la plataforma (TripPickupsService) y la simulación

export interface PickupPoint {
  id: string;
  location: Point;
}

// Una recogida a menos de esto de la salida del conductor no es una parada:
// el conductor ya está ahí
const SAME_PLACE_M = 50;
const METERS_PER_DEGREE = 111_320;

// En metros, en el plano local (a la escala del campus la curvatura no cuenta)
function toPlane([lon, lat]: number[], cosLat: number): [number, number] {
  return [lon * METERS_PER_DEGREE * cosLat, lat * METERS_PER_DEGREE];
}

// Dónde cae un punto a lo largo de la ruta: metros desde su inicio hasta la
// proyección del punto sobre el tramo más cercano
function distanceAlong(route: LineString, location: Point): number {
  const cosLat = Math.cos((location.coordinates[1] * Math.PI) / 180);
  const [px, py] = toPlane(location.coordinates, cosLat);
  const vertices = route.coordinates.map((vertex) => toPlane(vertex, cosLat));
  let best = { gap: Infinity, along: 0 };
  let travelled = 0;
  for (let i = 1; i < vertices.length; i++) {
    const [ax, ay] = vertices[i - 1];
    const [bx, by] = vertices[i];
    const length = Math.hypot(bx - ax, by - ay);
    const t =
      length === 0
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / length ** 2,
            ),
          );
    const gap = Math.hypot(
      px - (ax + t * (bx - ax)),
      py - (ay + t * (by - ay)),
    );
    if (gap < best.gap) {
      best = { gap, along: travelled + t * length };
    }
    travelled += length;
  }
  return best.along;
}

// Las recogidas en el orden en que el conductor las encuentra en su ruta
export function orderPickups<T extends PickupPoint>(
  route: LineString,
  pickups: readonly T[],
): T[] {
  return pickups
    .map((pickup) => ({ pickup, along: distanceAlong(route, pickup.location) }))
    .sort((a, b) => a.along - b.along)
    .map(({ pickup }) => pickup);
}

// Las recogidas que son una parada de verdad (no en la salida del conductor)
export function stopCount(
  origin: Point,
  pickups: readonly PickupPoint[],
): number {
  const cosLat = Math.cos((origin.coordinates[1] * Math.PI) / 180);
  const [ox, oy] = toPlane(origin.coordinates, cosLat);
  return pickups.filter(({ location }) => {
    const [x, y] = toPlane(location.coordinates, cosLat);
    return Math.hypot(x - ox, y - oy) > SAME_PLACE_M;
  }).length;
}

// Desvío gastado: lo que alarga la ruta pasar por las recogidas más el tiempo
// de cada parada. Nunca negativo (la ruta por carretera puede salir más corta
// que la directa estimada)
export function usedDetourMin(plan: {
  durationMin: number;
  directDurationMin: number;
  stops: number;
}): number {
  return Math.max(
    0,
    plan.durationMin - plan.directDurationMin + STOP_TIME_MIN * plan.stops,
  );
}

export function fitsBudget(usedMin: number, maxDetourMin: number): boolean {
  return usedMin <= maxDetourMin;
}

// Minutos desde la salida hasta cada recogida: los tramos de la ruta (el
// primero, de la salida a la primera recogida) más el tiempo de cada parada
// anterior. Una recogida con tramo 0 está en la salida: no es una parada
export function pickupOffsets(legsMin: readonly number[]): number[] {
  let elapsed = 0;
  return legsMin.map((legMin, index) => {
    const previousLeg = index > 0 ? legsMin[index - 1] : 0;
    elapsed += legMin + (index > 0 && previousLeg > 0 ? STOP_TIME_MIN : 0);
    return elapsed;
  });
}

// Recogida en puntos: minutos desde la salida hasta cada parada (en orden a
// lo largo de la ruta). A su tramo por la ruta se suma el tiempo de cada
// parada ANTERIOR en la que ya sube alguien
export function stopPickupOffsets(
  stops: readonly { id: string; etaOffsetMin: number }[],
  occupiedStopIds: ReadonlySet<string>,
): Map<string, number> {
  let earlierStopsMin = 0;
  return new Map(
    stops.map(({ id, etaOffsetMin }) => {
      const offset = etaOffsetMin + earlierStopsMin;
      if (occupiedStopIds.has(id)) {
        earlierStopsMin += STOP_TIME_MIN;
      }
      return [id, offset];
    }),
  );
}
