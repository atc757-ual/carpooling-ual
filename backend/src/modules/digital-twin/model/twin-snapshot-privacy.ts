import { approximateCoordinates } from '../../../shared/geo/approximate-coordinates';
import { TwinPoint } from './twin-event';
import {
  RequestState,
  SystemTwinSnapshot,
  TripRouteState,
  TripTwinState,
  UserTwinState,
  VehicleTwinState,
} from './twin-snapshot';

// La copia del gemelo vivo que se guarda con una simulación, protegida
// (decidido con el autor el 28/11/2026): a la simulación le bastan las plazas,
// las horas y las rutas aproximadas, así que
// - minimizada: solo los viajes abiertos, sus vehículos y los usuarios
//   activos; sin la posición del conductor, sin el recorrido y con los puntos
//   redondeados a la cuadrícula común (shared/geo, unos 350 m);
// - seudonimizada: cada identificador pasa a un alias («viaje-1», «usuario-1»…),
//   el mismo en toda la copia para que las referencias sigan encajando.
// Además, la copia se borra al terminar la ejecución; solo queda su resumen
const OPEN_TRIP_STATUSES: ReadonlySet<string> = new Set([
  'published',
  'confirmed',
  'in_progress',
]);

// Lo que se queda de la copia cuando se borra: sin datos personales
export interface TwinSnapshotSummary {
  takenAt: string;
  openTrips: number;
  tripsInProgress: number;
  vehicles: number;
  activeUsers: number;
  drivers: number;
  offeredSeats: number;
  availableSeats: number;
}

type AliasKind = 'viaje' | 'vehiculo' | 'usuario' | 'solicitud' | 'parada';

// Un alias por identificador y tipo, en el orden en que aparecen
class AliasBook {
  private readonly aliases = new Map<string, string>();
  private readonly counters = new Map<AliasKind, number>();

  of(kind: AliasKind, id: string): string {
    const key = `${kind}:${id}`;
    let alias = this.aliases.get(key);
    if (alias === undefined) {
      const next = (this.counters.get(kind) ?? 0) + 1;
      this.counters.set(kind, next);
      alias = `${kind}-${next}`;
      this.aliases.set(key, alias);
    }
    return alias;
  }

  ofNullable(kind: AliasKind, id: string | null): string | null {
    return id === null ? null : this.of(kind, id);
  }
}

function approximate(point: TwinPoint | null): TwinPoint | null {
  return point === null
    ? null
    : { type: 'Point', coordinates: approximateCoordinates(point.coordinates) };
}

export function protectSnapshot(
  snapshot: SystemTwinSnapshot,
): SystemTwinSnapshot {
  const aliases = new AliasBook();
  const openTrips = snapshot.trips.filter(
    (trip) => trip.status !== null && OPEN_TRIP_STATUSES.has(trip.status),
  );
  const openTripIds = new Set(openTrips.map((trip) => trip.id));
  const vehicleIds = new Set(openTrips.map((trip) => trip.vehicleId));
  return {
    ...snapshot,
    trips: openTrips.map((trip) => protectTrip(trip, aliases)),
    vehicles: snapshot.vehicles
      .filter((vehicle) => vehicleIds.has(vehicle.id))
      .map((vehicle) => protectVehicle(vehicle, openTripIds, aliases)),
    users: snapshot.users
      .filter((user) => user.isActive)
      .map((user) => protectUser(user, aliases)),
  };
}

function protectTrip(trip: TripTwinState, aliases: AliasBook): TripTwinState {
  return {
    ...trip,
    id: aliases.of('viaje', trip.id),
    driverId: aliases.ofNullable('usuario', trip.driverId),
    vehicleId: aliases.ofNullable('vehiculo', trip.vehicleId),
    position: null,
    positionAt: null,
    requests: trip.requests.map((request) => protectRequest(request, aliases)),
    route: protectRoute(trip.route, aliases),
  };
}

function protectRequest(
  request: RequestState,
  aliases: AliasBook,
): RequestState {
  return {
    ...request,
    id: aliases.of('solicitud', request.id),
    passengerId: aliases.ofNullable('usuario', request.passengerId),
    pickupPoint: approximate(request.pickupPoint),
    stopId: aliases.ofNullable('parada', request.stopId),
  };
}

function protectRoute(
  route: TripRouteState,
  aliases: AliasBook,
): TripRouteState {
  return {
    origin: approximate(route.origin),
    destination: approximate(route.destination),
    stops: route.stops.map((stop) => ({
      ...stop,
      id: aliases.of('parada', stop.id),
      name: null,
      point: approximate(stop.point),
    })),
    track: [],
    trackPoints: 0,
    travelledKm: 0,
  };
}

function protectVehicle(
  vehicle: VehicleTwinState,
  openTripIds: ReadonlySet<string>,
  aliases: AliasBook,
): VehicleTwinState {
  const activeTripId =
    vehicle.activeTripId !== null && openTripIds.has(vehicle.activeTripId)
      ? aliases.of('viaje', vehicle.activeTripId)
      : null;
  return {
    ...vehicle,
    id: aliases.of('vehiculo', vehicle.id),
    driverId: aliases.ofNullable('usuario', vehicle.driverId),
    activeTripId,
    scheduledTripIds: vehicle.scheduledTripIds
      .filter((tripId) => openTripIds.has(tripId))
      .map((tripId) => aliases.of('viaje', tripId)),
    position: null,
    positionAt: null,
  };
}

function protectUser(user: UserTwinState, aliases: AliasBook): UserTwinState {
  return { ...user, id: aliases.of('usuario', user.id) };
}

export function summarizeSnapshot(
  snapshot: SystemTwinSnapshot,
): TwinSnapshotSummary {
  const openTrips = snapshot.trips.filter(
    (trip) => trip.status !== null && OPEN_TRIP_STATUSES.has(trip.status),
  );
  const activeUsers = snapshot.users.filter((user) => user.isActive);
  return {
    takenAt: snapshot.takenAt,
    openTrips: openTrips.length,
    tripsInProgress: openTrips.filter((trip) => trip.status === 'in_progress')
      .length,
    vehicles: snapshot.vehicles.length,
    activeUsers: activeUsers.length,
    drivers: activeUsers.filter((user) => user.profiles.includes('driver'))
      .length,
    offeredSeats: sum(openTrips.map((trip) => trip.offeredSeats)),
    availableSeats: sum(openTrips.map((trip) => trip.availableSeats)),
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
