import { TRIP_STATE_EVENTS } from './trip-twin';
import {
  readDate,
  readPoint,
  readString,
  TwinEvent,
  TwinPoint,
} from './twin-event';

// on_trip: en un viaje en curso; scheduled: con viajes publicados o
// confirmados por hacer; idle: sin ninguno
export const VEHICLE_TWIN_STATUSES = ['idle', 'scheduled', 'on_trip'] as const;
export type VehicleTwinStatus = (typeof VEHICLE_TWIN_STATUSES)[number];
const SCHEDULED_TRIP_STATUSES: ReadonlySet<string> = new Set([
  'published',
  'confirmed',
]);

// Gemelo de un vehículo (DP-10). Aún no hay eventos vehicle.*: su estado sale
// de los viajes que lo usan (cada evento trip.* lleva el vehicleId) y de las
// posiciones del viaje en curso. Clase pura, como TripTwin
export class VehicleTwin {
  driverId: string | null = null;
  activeTripId: string | null = null;
  readonly scheduledTripIds = new Set<string>();
  position: TwinPoint | null = null;
  positionAt: Date | null = null;
  updatedAt: Date | null = null;

  constructor(readonly id: string) {}

  get status(): VehicleTwinStatus {
    if (this.activeTripId !== null) {
      return 'on_trip';
    }
    return this.scheduledTripIds.size > 0 ? 'scheduled' : 'idle';
  }

  // Aplica un evento de un viaje que lo usa (o lo usaba: si el viaje ha
  // cambiado de vehículo, lo suelta). Devuelve false si no le afecta
  apply(event: TwinEvent): boolean {
    if (TRIP_STATE_EVENTS.has(event.type)) {
      this.applyTrip(event);
    } else if (
      event.type === 'trip.position_updated' &&
      event.sourceEntityId === this.activeTripId
    ) {
      this.position = readPoint(event.payload, 'position');
      this.positionAt = readDate(event.payload, 'recordedAt');
    } else {
      return false;
    }
    this.updatedAt = event.occurredAt;
    return true;
  }

  private applyTrip({ payload, sourceEntityId: tripId }: TwinEvent): void {
    const isMine = readString(payload, 'vehicleId') === this.id;
    const status = isMine ? readString(payload, 'status') : null;
    if (isMine) {
      this.driverId = readString(payload, 'driverId') ?? this.driverId;
    }
    if (status !== null && SCHEDULED_TRIP_STATUSES.has(status)) {
      this.scheduledTripIds.add(tripId);
    } else {
      this.scheduledTripIds.delete(tripId);
    }
    if (status === 'in_progress') {
      this.activeTripId = tripId;
    } else if (this.activeTripId === tripId) {
      // Termina, se cancela o pasa a otro vehículo: se olvida la posición
      this.activeTripId = null;
      this.position = null;
      this.positionAt = null;
    }
  }
}
