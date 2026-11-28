import { TwinPoint } from './twin-event';

// La copia del gemelo del sistema (lo acordado con el director el 27/10/2026):
// el estado de todos sus gemelos de entidad en datos planos, para guardarla
// como JSON y crear con ella una instancia nueva e independiente. Así cada
// réplica de la simulación parte del estado real de la plataforma, evoluciona
// por su cuenta y se descarta. Las fechas van como texto ISO 8601
export const TWIN_SNAPSHOT_VERSION = 1;

export interface RouteStopState {
  id: string;
  order: number;
  name: string | null;
  point: TwinPoint | null;
  etaOffsetMin: number | null;
}

export interface TripRouteState {
  origin: TwinPoint | null;
  destination: TwinPoint | null;
  stops: RouteStopState[];
  track: TwinPoint[];
  trackPoints: number;
  travelledKm: number;
}

export interface RequestState {
  id: string;
  passengerId: string | null;
  seats: number;
  status: string;
  isBoarded: boolean;
  pickupPoint: TwinPoint | null;
  stopId: string | null;
  pickupAt: string | null;
}

export interface TripTwinState {
  id: string;
  driverId: string | null;
  vehicleId: string | null;
  status: string | null;
  departureAt: string | null;
  offeredSeats: number;
  availableSeats: number;
  startedAt: string | null;
  finishedAt: string | null;
  finishDistanceM: number | null;
  position: TwinPoint | null;
  positionAt: string | null;
  remainingKm: number | null;
  remainingMin: number | null;
  requests: RequestState[];
  route: TripRouteState;
  updatedAt: string | null;
}

export interface VehicleTwinState {
  id: string;
  driverId: string | null;
  activeTripId: string | null;
  scheduledTripIds: string[];
  position: TwinPoint | null;
  positionAt: string | null;
  updatedAt: string | null;
}

export interface UserTwinState {
  id: string;
  profiles: string[];
  activeMode: string | null;
  isActive: boolean;
  isPhoneVerified: boolean;
  updatedAt: string | null;
}

export interface SystemTwinSnapshot {
  version: typeof TWIN_SNAPSHOT_VERSION;
  // Cuándo se copió el gemelo vivo
  takenAt: string;
  // El último evento que había aplicado: la réplica sigue desde ahí
  lastSequence: number;
  lastEventAt: string | null;
  trips: TripTwinState[];
  vehicles: VehicleTwinState[];
  users: UserTwinState[];
}

export function toIso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

export function fromIso(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

// Copia profunda de un punto GeoJSON: la instancia nueva no comparte nada
// con la de origen
export function copyPoint(point: TwinPoint | null): TwinPoint | null {
  return point === null
    ? null
    : {
        type: point.type,
        coordinates: [point.coordinates[0], point.coordinates[1]],
      };
}
