import { translate } from '@jsverse/transloco';
import { ApiError } from '../../../core/models/api-error.model';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatDateLabel } from '../publish-trip/publish-trip.utils';

// Publicar el mismo viaje otros días (viajes recurrentes): los días que salen
// de los días de la semana elegidos y la fecha «hasta». Las fechas son
// «AAAA-MM-DD», del calendario (sin horas ni zona)

// Como la API: hasta 30 días más y el último, como mucho a un mes de hoy
export const MAX_REPEAT_DATES = 30;
export const MAX_DAYS_AHEAD = 31;
// Por defecto, hasta 4 semanas después del primero
const DEFAULT_WEEKS = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

// Lunes (1) a domingo (7), en ese orden
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

// 1 (lunes) a 7 (domingo)
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

// El día de hoy (en el dispositivo), como el de los campos de fecha
export function localDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// El último día que se puede elegir en «Hasta»
export function latestRepeatDate(today: string): string {
  return addDays(today, MAX_DAYS_AHEAD);
}

// «Hasta», al empezar: 4 semanas después del primero, sin pasar del límite
export function defaultRepeatUntil(firstDate: string, today: string): string {
  const proposed = addDays(firstDate, DEFAULT_WEEKS * 7 - 1);
  const latest = latestRepeatDate(today);
  return proposed < latest ? proposed : latest;
}

// Los otros días: después del primero y hasta «until», los de esos días de
// la semana (como mucho MAX_REPEAT_DATES)
export function repeatDatesFor(
  firstDate: string,
  weekdays: readonly number[],
  until: string,
): string[] {
  const chosen = new Set(weekdays);
  const dates: string[] = [];
  for (
    let date = addDays(firstDate, 1);
    date <= until && dates.length < MAX_REPEAT_DATES;
    date = addDays(date, 1)
  ) {
    if (chosen.has(weekdayOf(date))) {
      dates.push(date);
    }
  }
  return dates;
}

// El día que la API no pudo publicar (REPEAT_DATE_REJECTED: su mensaje
// empieza por «Repeat date AAAA-MM-DD»), o null
export function rejectedRepeatDate(error: ApiError): string | null {
  if (error.code !== 'REPEAT_DATE_REJECTED') {
    return null;
  }
  return /^Repeat date (\d{4}-\d{2}-\d{2})/.exec(error.details.message ?? '')?.[1] ?? null;
}

// El error al publicar: si falla uno de los otros días, cuál; si no, el de
// siempre
export function publishErrorMessage(error: ApiError): string {
  const date = rejectedRepeatDate(error);
  return date
    ? translate('publish.repeat.dateRejected', { date: formatDateLabel(date) })
    : getErrorMessage(error);
}
