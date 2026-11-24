import { TripDirection, TripSearch } from '../../../core/models/trip-search.model';
import { UsualTrip } from '../../../core/models/usual-trip.model';
import { toIsoDate } from '../../../shared/utils/date.util';
import { addDays, weekdayOf } from '../../../shared/utils/weekdays.util';
import { parseTripSearch } from '../trip-search';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// La llegada al campus que se propone al guardar desde una búsqueda de vuelta
const DEFAULT_ARRIVAL_TIME = '08:00';

function isWeekdays(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)
  );
}

// Lo guardado, si vale (puede venir de una versión anterior o estar roto); si
// no, null. El sitio, el parking, la hora, el margen y las plazas se
// comprueban como los de una búsqueda
export function parseUsualTrip(value: unknown): UsualTrip | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { weekdays, arrivalTime, returnTime, ...rest } = value as Record<string, unknown>;
  const search = parseTripSearch({
    ...rest,
    direction: 'to-campus',
    date: '2000-01-01',
    time: arrivalTime,
  });
  const isReturnValid =
    returnTime === null || (typeof returnTime === 'string' && TIME.test(returnTime));
  if (search === null || !isWeekdays(weekdays) || !isReturnValid) {
    return null;
  }
  return {
    place: search.place,
    parking: search.parking,
    weekdays: [...new Set(weekdays)].sort((a, b) => a - b),
    arrivalTime: search.time,
    returnTime,
    margin: search.margin,
    seats: search.seats,
  };
}

// El trayecto de una búsqueda: al ir, su hora es la llegada; al volver, la
// salida de la vuelta (y la llegada, la de por defecto). El día de la semana,
// el de la búsqueda
export function usualTripFromSearch(search: TripSearch): UsualTrip {
  const isToCampus = search.direction === 'to-campus';
  return {
    place: search.place,
    parking: search.parking,
    weekdays: [weekdayOf(search.date)],
    arrivalTime: isToCampus ? search.time : DEFAULT_ARRIVAL_TIME,
    returnTime: isToCampus ? null : search.time,
    margin: search.margin,
    seats: search.seats,
  };
}

// El próximo día que toca: hoy si es uno de sus días y aún no ha pasado la
// hora; si no, el siguiente de sus días
export function nextUsualDate(weekdays: readonly number[], time: string, now: Date): string {
  const today = toIsoDate(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isTodayOpen = weekdays.includes(weekdayOf(today)) && time > currentTime;
  if (isTodayOpen) {
    return today;
  }
  const next = [1, 2, 3, 4, 5, 6, 7]
    .map((days) => addDays(today, days))
    .find((date) => weekdays.includes(weekdayOf(date)));
  return next ?? today;
}

// La búsqueda de la ida o de la vuelta para el próximo día que toca
export function usualTripSearch(trip: UsualTrip, direction: TripDirection, now: Date): TripSearch {
  const time = direction === 'to-campus' ? trip.arrivalTime : (trip.returnTime ?? trip.arrivalTime);
  return {
    place: trip.place,
    parking: trip.parking,
    direction,
    date: nextUsualDate(trip.weekdays, time, now),
    time,
    margin: trip.margin,
    seats: trip.seats,
  };
}
