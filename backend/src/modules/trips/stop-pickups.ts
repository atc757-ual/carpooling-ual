import type { Point } from 'typeorm';
import { StopNotInTripError } from './errors/stop-not-in-trip.error';
import { stopPickupOffsets, usedDetourMin } from './pickup-plan';
import type { RoutePlan } from './route-plan';

// Recogida en puntos, sin base de datos ni OSRM: la ruta ya pasa por todas
// las paradas (se calculó al publicar), así que recoger a alguien solo gasta
// el tiempo de su parada si aún no sube nadie en ella

export interface StopPickupPoint {
  id: string;
  location: Point;
  stopId: string | null;
}

export interface PlannedStopPickup {
  requestId: string;
  location: Point;
  stopId: string | null;
  position: number;
  etaOffsetMin: number;
}

export interface StopPickupsPlan {
  pickups: PlannedStopPickup[];
  usedDetourMin: number;
}

export function planStopPickups(input: {
  tripId: string;
  stops: readonly { id: string; position: number; etaOffsetMin: number }[];
  points: readonly StopPickupPoint[];
  route: Pick<RoutePlan, 'durationMin'> & { directDurationMin: number };
}): StopPickupsPlan {
  const positions = new Map(
    input.stops.map(({ id, position }) => [id, position]),
  );
  const stopPosition = (stopId: string | null): number => {
    const position = stopId === null ? undefined : positions.get(stopId);
    if (position === undefined) {
      throw new StopNotInTripError(input.tripId, stopId);
    }
    return position;
  };
  const ordered = input.points
    .map((point) => ({ point, at: stopPosition(point.stopId) }))
    .sort((a, b) => a.at - b.at || a.point.id.localeCompare(b.point.id))
    .map(({ point }) => point);
  const occupied = new Set(ordered.map(({ stopId }) => stopId as string));
  const offsets = stopPickupOffsets(
    [...input.stops].sort((a, b) => a.position - b.position),
    occupied,
  );
  return {
    pickups: ordered.map(({ id, location, stopId }, position) => ({
      requestId: id,
      location,
      stopId,
      position,
      etaOffsetMin: offsets.get(stopId as string) ?? 0,
    })),
    usedDetourMin: usedDetourMin({
      durationMin: input.route.durationMin,
      directDurationMin: input.route.directDurationMin,
      stops: occupied.size,
    }),
  };
}
