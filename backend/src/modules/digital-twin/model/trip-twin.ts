import {
  readDate,
  readNumber,
  readPoint,
  readString,
  TwinEvent,
  TwinPoint,
} from './twin-event';

// Estados del viaje tal y como llegan en los eventos. El gemelo no importa
// los de trips: solo conoce el contrato de los eventos (fronteras del módulo)
export const TRIP_TWIN_STATUSES = [
  'published',
  'confirmed',
  'in_progress',
  'finished',
  'cancelled',
  'expired',
] as const;
export type TripTwinStatus = (typeof TRIP_TWIN_STATUSES)[number];
const TRIP_STATUS_SET: ReadonlySet<string> = new Set(TRIP_TWIN_STATUSES);
const CLOSED_STATUSES: ReadonlySet<TripTwinStatus> = new Set([
  'finished',
  'cancelled',
  'expired',
]);

export interface RequestTwinState {
  passengerId: string | null;
  seats: number;
  status: string;
  isBoarded: boolean;
}

// Los eventos del viaje (trip.*) llevan su estado completo: se sustituye
export const TRIP_STATE_EVENTS: ReadonlySet<string> = new Set([
  'trip.published',
  'trip.updated',
  'trip.confirmed',
  'trip.reopened',
  'trip.started',
  'trip.finished',
  'trip.cancelled',
  'trip.expired',
]);

// Gemelo de un viaje (DP-10): su estado, sus solicitudes y, mientras está en
// curso, la última posición del conductor. Clase pura: no toca la base de
// datos, solo aplica eventos (también en cada réplica de la simulación)
export class TripTwin {
  driverId: string | null = null;
  vehicleId: string | null = null;
  status: TripTwinStatus | null = null;
  departureAt: Date | null = null;
  offeredSeats = 0;
  availableSeats = 0;
  startedAt: Date | null = null;
  finishedAt: Date | null = null;
  // Metros entre el conductor y el destino al terminar (trip.finished v2)
  finishDistanceM: number | null = null;
  position: TwinPoint | null = null;
  positionAt: Date | null = null;
  remainingKm: number | null = null;
  remainingMin: number | null = null;
  readonly requests = new Map<string, RequestTwinState>();
  updatedAt: Date | null = null;

  constructor(readonly id: string) {}

  get seatsTaken(): number {
    return this.offeredSeats - this.availableSeats;
  }

  // Pasajeros a bordo: las plazas de las solicitudes aceptadas ya validadas
  // con el código de recogida
  get passengersOnBoard(): number {
    let seats = 0;
    for (const request of this.requests.values()) {
      if (request.status === 'accepted' && request.isBoarded) {
        seats += request.seats;
      }
    }
    return seats;
  }

  get isClosed(): boolean {
    return this.status !== null && CLOSED_STATUSES.has(this.status);
  }

  // Aplica un evento del viaje, de su posición o de una de sus solicitudes.
  // Devuelve false si el evento no le afecta
  apply(event: TwinEvent): boolean {
    if (TRIP_STATE_EVENTS.has(event.type)) {
      this.applyState(event);
    } else if (event.type === 'trip.position_updated') {
      this.applyPosition(event);
    } else if (event.type.startsWith('request.')) {
      this.applyRequest(event);
    } else {
      return false;
    }
    this.updatedAt = event.occurredAt;
    return true;
  }

  private applyState({ payload, type }: TwinEvent): void {
    const status = readString(payload, 'status');
    if (status !== null && TRIP_STATUS_SET.has(status)) {
      this.status = status as TripTwinStatus;
    }
    this.driverId = readString(payload, 'driverId') ?? this.driverId;
    this.vehicleId = readString(payload, 'vehicleId');
    this.departureAt = readDate(payload, 'departureAt');
    this.offeredSeats = readNumber(payload, 'offeredSeats') ?? 0;
    this.availableSeats = readNumber(payload, 'availableSeats') ?? 0;
    this.startedAt = readDate(payload, 'startedAt');
    if (type === 'trip.finished') {
      // v1 no traía estos campos: se quedan sin dato
      this.finishedAt = readDate(payload, 'finishedAt');
      this.finishDistanceM = readNumber(payload, 'finishDistanceM');
    }
    if (this.isClosed) {
      // Minimización: al cerrarse el viaje, el gemelo olvida dónde estaba el
      // conductor; le basta el estado y las métricas
      this.position = null;
      this.positionAt = null;
      this.remainingKm = null;
      this.remainingMin = null;
    }
  }

  // Solo cuenta mientras el viaje está en curso
  private applyPosition({ payload }: TwinEvent): void {
    if (this.status !== 'in_progress') {
      return;
    }
    this.position = readPoint(payload, 'position');
    this.positionAt = readDate(payload, 'recordedAt');
    this.remainingKm = readNumber(payload, 'remainingKm');
    this.remainingMin = readNumber(payload, 'remainingMin');
  }

  // Lo que no trae el evento se queda como estaba (p. ej. request.boarded v1,
  // que no llevaba estado ni plazas)
  private applyRequest({ payload, sourceEntityId }: TwinEvent): void {
    const previous = this.requests.get(sourceEntityId);
    this.requests.set(sourceEntityId, {
      passengerId:
        readString(payload, 'passengerId') ?? previous?.passengerId ?? null,
      seats: readNumber(payload, 'seats') ?? previous?.seats ?? 1,
      status: readString(payload, 'status') ?? previous?.status ?? 'pending',
      isBoarded: readString(payload, 'boardedAt') !== null,
    });
  }
}
