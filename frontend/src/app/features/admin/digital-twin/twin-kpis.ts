import { DigitalTwinState } from '../../../core/models/digital-twin.model';
import type { OverviewKpi } from './event-labels';

// Objetivo del retraso entre un evento y el gemelo (RNF-07, DP-04)
export const LAG_TARGET_MS = 1000;

export type TwinSyncTone = 'info' | 'success' | 'warning';

export interface TwinSync {
  tone: TwinSyncTone;
  text: string;
}

// Las cifras del gemelo: vehículos, viajes y usuarios por estado
export function twinKpis(state: DigitalTwinState): OverviewKpi[] {
  const { trips, vehicles, users } = state;
  return [
    {
      label: 'Vehículos en viaje',
      value: String(vehicles.on_trip),
      hint: `${vehicles.scheduled} con viajes por hacer · ${vehicles.idle} sin viajes`,
    },
    {
      label: 'Pasajeros a bordo',
      value: String(state.passengersOnBoard),
      hint: 'Con la subida validada',
    },
    {
      label: 'Viajes por salir',
      value: String(trips.published + trips.confirmed),
      hint: `${trips.confirmed} confirmados`,
    },
    {
      label: 'Viajes terminados',
      value: String(trips.finished),
      hint: `${trips.cancelled} cancelados`,
    },
    {
      label: 'Usuarios activos',
      value: String(users.active),
      hint: `${users.drivers} conductores · ${users.inDriverMode} en modo conductor`,
    },
  ];
}

// Cómo va la sincronización con la plataforma, en una frase
export function twinSync(state: DigitalTwinState): TwinSync {
  if (!state.isLive) {
    return {
      tone: 'info',
      text: `Reproduciendo los eventos guardados (van ${state.lastSequence}).`,
    };
  }
  const { p95Ms, samples } = state.lag;
  if (p95Ms === null) {
    return {
      tone: 'success',
      text: 'Al día con la plataforma. Aún no ha llegado ningún evento nuevo para medir el retraso.',
    };
  }
  const isOnTarget = p95Ms <= LAG_TARGET_MS;
  return {
    tone: isOnTarget ? 'success' : 'warning',
    text:
      `Al día con la plataforma. Retraso p95: ${p95Ms} ms en los últimos ${samples} eventos ` +
      `(objetivo ≤ ${LAG_TARGET_MS} ms${isOnTarget ? '' : ', superado'}).`,
  };
}
