import type { TwinEvent } from '../model/twin-event';

// Cuánto se espera a que aparezca la secuencia que falta antes de darla por
// perdida (una transacción deshecha también consume su número)
export const GAP_WAIT_MS = 2000;

// Un hueco abierto: la última secuencia antes de él y cuándo se vio
export interface PendingGap {
  afterSequence: number;
  seenAt: number;
}

export interface ReadySelection {
  ready: TwinEvent[];
  gap: PendingGap | null;
}

// La secuencia se pone al guardar y no al confirmar: dos transacciones
// simultáneas pueden dejar ver la 11 antes que la 10 (docs/api/events.md).
// Devuelve los eventos que se pueden aplicar ya, en orden, hasta el primer
// hueco que aún puede llenarse. Un hueco se da por cerrado cuando lleva
// GAP_WAIT_MS abierto o cuando el evento de después es más antiguo que eso
// (p. ej. al reproducir desde el principio)
export function selectReady(
  events: readonly TwinEvent[],
  lastSequence: number,
  previousGap: PendingGap | null,
  now: number,
): ReadySelection {
  const ready: TwinEvent[] = [];
  let previous = lastSequence;
  for (const event of events) {
    if (event.sequence > previous + 1) {
      const seenAt =
        previousGap?.afterSequence === previous ? previousGap.seenAt : now;
      const isSettled =
        now - seenAt >= GAP_WAIT_MS ||
        now - event.occurredAt.getTime() >= GAP_WAIT_MS;
      if (!isSettled) {
        return { ready, gap: { afterSequence: previous, seenAt } };
      }
    }
    ready.push(event);
    previous = event.sequence;
  }
  return { ready, gap: null };
}
