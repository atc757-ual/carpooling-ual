import { BusinessError } from '../../shared/errors/business-error';
import { InvalidRepeatDatesError } from './errors/invalid-repeat-dates.error';
import { RepeatDateRejectedError } from './errors/repeat-date-rejected.error';

// Publicar el mismo viaje varios días a la vez (viajes recurrentes, opción A):
// cada día es un viaje independiente, a la misma hora de reloj en España
// (también si en medio cambia la hora)
export const SERIES_TIME_ZONE = 'Europe/Madrid';
// Hasta un mes: los días que se pueden repetir y lo lejos que puede quedar el
// último (contando desde hoy)
export const MAX_REPEAT_DATES = 30;
export const MAX_DAYS_AHEAD = 31;

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const LOCAL_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: SERIES_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

// La hora de reloj en España de un instante, como si fuera UTC
function wallClockOf(instant: Date): Date {
  const parts = Object.fromEntries(
    LOCAL_PARTS.formatToParts(instant).map(({ type, value }) => [type, value]),
  );
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
      instant.getUTCMilliseconds(),
    ),
  );
}

// Lo que España va por delante de UTC en ese instante (1 o 2 h, en ms)
function offsetMs(instant: Date): number {
  return wallClockOf(instant).getTime() - instant.getTime();
}

// «2026-12-01»: el día en España de un instante
export function localDateOf(instant: Date): string {
  return wallClockOf(instant).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

// Un día que existe en el calendario (no «2026-02-30»)
function isCalendarDate(date: string): boolean {
  const time = Date.parse(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === date
  );
}

// El instante de ese día a la misma hora de reloj (en España) que reference
export function sameTimeOn(reference: Date, date: string): Date {
  const wall = wallClockOf(reference);
  const [year, month, day] = date.split('-').map(Number);
  const wallTarget = Date.UTC(
    year,
    month - 1,
    day,
    wall.getUTCHours(),
    wall.getUTCMinutes(),
    wall.getUTCSeconds(),
    wall.getUTCMilliseconds(),
  );
  // El desfase de ese día se mira en el propio día (con el cambio de hora,
  // no es el del día de referencia)
  const guess = new Date(wallTarget - offsetMs(new Date(wallTarget)));
  return new Date(wallTarget - offsetMs(guess));
}

// El mismo viaje, el día date de la serie que empieza en first: sus horas
// (la ida y, si la hay, la vuelta) se mueven los mismos días, a la misma hora
// de reloj
export function moveToSeriesDate(
  departure: Date,
  first: Date,
  date: string,
): Date {
  const days = Math.round(
    (Date.parse(date) - Date.parse(localDateOf(first))) / DAY_MS,
  );
  return sameTimeOn(departure, addDays(localDateOf(departure), days));
}

// Los días que se repiten: del calendario, después del primero (en España) y
// hasta un mes desde hoy. Sin repetidos ni más de MAX_REPEAT_DATES (lo
// comprueba también el DTO)
export function assertRepeatDates(
  firstDeparture: Date,
  dates: readonly string[],
  now: Date,
): void {
  const first = localDateOf(firstDeparture);
  const last = addDays(localDateOf(now), MAX_DAYS_AHEAD);
  const wrong = dates.find(
    (date) => !isCalendarDate(date) || date <= first || date > last,
  );
  if (wrong !== undefined) {
    throw new InvalidRepeatDatesError(wrong, first, last);
  }
  if (new Set(dates).size !== dates.length || dates.length > MAX_REPEAT_DATES) {
    throw new InvalidRepeatDatesError(null, first, last);
  }
}

// Lo que falla en un día repetido se dice como de ese día
// (REPEAT_DATE_REJECTED), para que quien publica sepa cuál quitar
export async function asRepeatDate<T>(
  date: string,
  step: () => Promise<T>,
): Promise<T> {
  try {
    return await step();
  } catch (error) {
    throw error instanceof BusinessError
      ? new RepeatDateRejectedError(date, error)
      : error;
  }
}
