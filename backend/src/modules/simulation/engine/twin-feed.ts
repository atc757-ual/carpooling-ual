import { SystemTwin } from '../../digital-twin/model/system-twin';
import type { TwinEvent } from '../../digital-twin/model/twin-event';

// Hora de referencia de la simulación: un día lectivo cualquiera
const SIMULATED_DAY = Date.UTC(2026, 10, 2);

export function atMinute(minuteOfDay: number): Date {
  return new Date(SIMULATED_DAY + minuteOfDay * 60_000);
}

// El gemelo de una réplica (DP-10): una instancia propia que recibe eventos
// simulados con el mismo contrato que los de la plataforma, evoluciona y se
// descarta al terminar, quedándose solo con las métricas
export class TwinFeed {
  readonly twin = new SystemTwin();
  private sequence = 0;

  trip(
    type: string,
    tripId: string,
    state: { vehicleId: string; status: string; seats: number; free: number },
  ): void {
    this.emit(type, tripId, {
      driverId: tripId,
      vehicleId: state.vehicleId,
      status: state.status,
      offeredSeats: state.seats,
      availableSeats: state.free,
    });
  }

  request(
    type: string,
    requestId: string,
    state: { tripId: string; status: string; isBoarded?: boolean },
  ): void {
    this.emit(type, requestId, {
      tripId: state.tripId,
      passengerId: requestId,
      seats: 1,
      status: state.status,
      boardedAt: state.isBoarded ? atMinute(0).toISOString() : null,
    });
  }

  private emit(
    type: string,
    sourceEntityId: string,
    payload: Record<string, unknown>,
  ): void {
    this.sequence += 1;
    const event: TwinEvent = {
      id: `sim-${this.sequence}`,
      sequence: this.sequence,
      type,
      version: 1,
      sourceEntityId,
      payload,
      occurredAt: atMinute(0),
    };
    this.twin.apply(event);
  }
}
