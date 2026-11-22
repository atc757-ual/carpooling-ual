import {
  ARRIVAL_FROM_MIN,
  ARRIVAL_TO_MIN,
  Commuter,
  DEPARTURE_FROM_MIN,
  DEPARTURE_TO_MIN,
} from './population';
import type { Leg } from './ride-matcher';

// Franjas de 30 minutos del día: las llegadas al campus (07:00 a 10:00) y
// después las salidas para volver (12:00 a 21:00). La gráfica del panel las
// enseña en este orden
const SLOT_MINUTES = 30;
const ARRIVAL_SLOTS = (ARRIVAL_TO_MIN - ARRIVAL_FROM_MIN) / SLOT_MINUTES;
const DEPARTURE_SLOTS = (DEPARTURE_TO_MIN - DEPARTURE_FROM_MIN) / SLOT_MINUTES;
export const SLOT_COUNT = ARRIVAL_SLOTS + DEPARTURE_SLOTS;

function toTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
}

// Inicio de cada franja de 30 minutos entre dos horas (en minutos del día)
export function slotsBetween(startMin: number, endMin: number): string[] {
  const slots: string[] = [];
  for (let m = startMin; m < endMin; m += SLOT_MINUTES) {
    slots.push(toTime(m));
  }
  return slots;
}

export const DAY_SLOTS = [
  ...slotsBetween(ARRIVAL_FROM_MIN, ARRIVAL_TO_MIN),
  ...slotsBetween(DEPARTURE_FROM_MIN, DEPARTURE_TO_MIN),
];

// La franja de un viaje: la de su llegada a la ida y la de su salida (después
// de las de llegada) a la vuelta
export function slotOf(commuter: Commuter, leg: Leg): number {
  if (leg === 'to-campus') {
    return Math.floor(
      (commuter.desiredArrivalMin - ARRIVAL_FROM_MIN) / SLOT_MINUTES,
    );
  }
  return (
    ARRIVAL_SLOTS +
    Math.floor(
      (commuter.desiredDepartureMin - DEPARTURE_FROM_MIN) / SLOT_MINUTES,
    )
  );
}
