import {
  TRIP_STATE_EVENTS,
  TRIP_TWIN_STATUSES,
  TripTwin,
  TripTwinStatus,
} from './trip-twin';
import { readString, TwinEvent } from './twin-event';
import {
  VEHICLE_TWIN_STATUSES,
  VehicleTwin,
  VehicleTwinStatus,
} from './vehicle-twin';
import { USER_EVENTS, UserTwin } from './user-twin';

// Usuarios con la cuenta activa o eliminada; de los activos, cuántos tienen
// cada perfil y cuántos viajan ahora en modo conductor
export interface UserTwinCounts {
  active: number;
  deactivated: number;
  drivers: number;
  passengers: number;
  inDriverMode: number;
}

// Versiones de cada tipo que el gemelo sabe leer (docs/api/events.md,
// «Cambios de versión»). Un tipo que no está aquí no le afecta (p. ej.
// user.updated o chat_message.sent); una versión desconocida se descarta y se
// cuenta
const V1: ReadonlySet<number> = new Set([1]);
export const SUPPORTED_EVENT_VERSIONS: Readonly<
  Record<string, ReadonlySet<number>>
> = {
  'trip.published': V1,
  'trip.updated': V1,
  'trip.confirmed': V1,
  'trip.reopened': V1,
  'trip.started': new Set([1, 2]),
  'trip.finished': new Set([1, 2]),
  'trip.cancelled': V1,
  'trip.expired': V1,
  'trip.position_updated': V1,
  'request.created': V1,
  'request.accepted': V1,
  'request.rejected': V1,
  'request.cancelled': V1,
  'request.expired': V1,
  'request.boarded': new Set([1, 2]),
  'user.registered': V1,
  'user.phone_verified': V1,
  'user.deactivated': V1,
  'user.profile_activated': V1,
  'user.profile_deactivated': V1,
  'user.active_mode_changed': V1,
};

// Cuántos identificadores recientes se recuerdan para descartar duplicados
// que lleguen con otra secuencia (RNF-11)
const RECENT_IDS_LIMIT = 1000;

export type ApplyOutcome = 'applied' | 'ignored' | 'duplicate' | 'unsupported';

export interface SystemTwinSummary {
  trips: Record<TripTwinStatus, number>;
  vehicles: Record<VehicleTwinStatus, number>;
  users: UserTwinCounts;
  // Plazas de pasajeros ya validados en los viajes en curso
  passengersOnBoard: number;
  lastSequence: number;
  appliedEvents: number;
  duplicateEvents: number;
  unsupportedEvents: number;
  lastEventAt: Date | null;
}

// Gemelo del sistema (opción B, DP-10): compuesto por los gemelos de entidad.
// Es el único punto de sincronización: recibe los eventos en orden de
// secuencia, descarta los ya aplicados y reparte cada uno a los gemelos que
// afecta. Puro, como sus gemelos: una instancia viva para la plataforma y una
// por réplica en la simulación
export class SystemTwin {
  readonly trips = new Map<string, TripTwin>();
  readonly vehicles = new Map<string, VehicleTwin>();
  readonly users = new Map<string, UserTwin>();
  lastSequence = 0;
  appliedEvents = 0;
  duplicateEvents = 0;
  unsupportedEvents = 0;
  lastEventAt: Date | null = null;
  private readonly recentIds = new Set<string>();

  apply(event: TwinEvent): ApplyOutcome {
    if (event.sequence <= this.lastSequence || this.recentIds.has(event.id)) {
      this.duplicateEvents += 1;
      return 'duplicate';
    }
    this.lastSequence = event.sequence;
    this.lastEventAt = event.occurredAt;
    this.remember(event.id);
    const versions = SUPPORTED_EVENT_VERSIONS[event.type];
    if (versions === undefined) {
      return 'ignored';
    }
    if (!versions.has(event.version)) {
      this.unsupportedEvents += 1;
      return 'unsupported';
    }
    const isApplied = this.dispatch(event);
    if (isApplied) {
      this.appliedEvents += 1;
    }
    return isApplied ? 'applied' : 'ignored';
  }

  summary(): SystemTwinSummary {
    const trips = countBy(TRIP_TWIN_STATUSES);
    let passengersOnBoard = 0;
    for (const trip of this.trips.values()) {
      if (trip.status !== null) {
        trips[trip.status] += 1;
      }
      if (trip.status === 'in_progress') {
        passengersOnBoard += trip.passengersOnBoard;
      }
    }
    const vehicles = countBy(VEHICLE_TWIN_STATUSES);
    for (const vehicle of this.vehicles.values()) {
      vehicles[vehicle.status] += 1;
    }
    return {
      trips,
      vehicles,
      users: this.countUsers(),
      passengersOnBoard,
      lastSequence: this.lastSequence,
      appliedEvents: this.appliedEvents,
      duplicateEvents: this.duplicateEvents,
      unsupportedEvents: this.unsupportedEvents,
      lastEventAt: this.lastEventAt,
    };
  }

  private countUsers(): UserTwinCounts {
    const counts: UserTwinCounts = {
      active: 0,
      deactivated: 0,
      drivers: 0,
      passengers: 0,
      inDriverMode: 0,
    };
    for (const user of this.users.values()) {
      if (!user.isActive) {
        counts.deactivated += 1;
        continue;
      }
      counts.active += 1;
      counts.drivers += user.profiles.has('driver') ? 1 : 0;
      counts.passengers += user.profiles.has('passenger') ? 1 : 0;
      counts.inDriverMode += user.activeMode === 'driver' ? 1 : 0;
    }
    return counts;
  }

  private dispatch(event: TwinEvent): boolean {
    if (USER_EVENTS.has(event.type)) {
      let user = this.users.get(event.sourceEntityId);
      if (user === undefined) {
        user = new UserTwin(event.sourceEntityId);
        this.users.set(user.id, user);
      }
      return user.apply(event);
    }
    if (TRIP_STATE_EVENTS.has(event.type)) {
      return this.applyTripState(event);
    }
    if (event.type === 'trip.position_updated') {
      const trip = this.trips.get(event.sourceEntityId);
      if (trip === undefined) {
        return false;
      }
      trip.apply(event);
      this.vehicleOf(trip)?.apply(event);
      return true;
    }
    // request.*: la solicitud pertenece al viaje de su payload
    const tripId = readString(event.payload, 'tripId');
    const trip = tripId === null ? undefined : this.trips.get(tripId);
    return trip?.apply(event) ?? false;
  }

  // El viaje y sus vehículos: el que usa ahora y, si lo ha cambiado, el
  // anterior (que lo suelta al ver otro vehicleId)
  private applyTripState(event: TwinEvent): boolean {
    let trip = this.trips.get(event.sourceEntityId);
    if (trip === undefined) {
      trip = new TripTwin(event.sourceEntityId);
      this.trips.set(trip.id, trip);
    }
    const previousVehicle = this.vehicleOf(trip);
    trip.apply(event);
    const vehicleId = trip.vehicleId;
    if (vehicleId !== null && !this.vehicles.has(vehicleId)) {
      this.vehicles.set(vehicleId, new VehicleTwin(vehicleId));
    }
    const vehicle = this.vehicleOf(trip);
    vehicle?.apply(event);
    if (previousVehicle !== undefined && previousVehicle !== vehicle) {
      previousVehicle.apply(event);
    }
    return true;
  }

  private vehicleOf(trip: TripTwin): VehicleTwin | undefined {
    return trip.vehicleId === null
      ? undefined
      : this.vehicles.get(trip.vehicleId);
  }

  private remember(eventId: string): void {
    this.recentIds.add(eventId);
    if (this.recentIds.size > RECENT_IDS_LIMIT) {
      // Un Set recorre en orden de inserción: el primero es el más antiguo
      const oldest = this.recentIds.values().next().value;
      if (oldest !== undefined) {
        this.recentIds.delete(oldest);
      }
    }
  }
}

function countBy<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}
