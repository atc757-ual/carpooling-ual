import { TripResult } from '../../core/models/trip-result.model';
import { TripSearch } from '../../core/models/trip-search.model';
import { CAMPUS_NAME, getEntranceName } from './campus-entrances';
import { shiftTime } from './trip-search-form/trip-search-form';

// Duración del viaje de ejemplo y cuánto antes de la hora pedida llega (o
// cuánto después sale, al volver)
const TRIP_MINUTES = 32;
const OFFSET_MINUTES = 8;

// Viaje de ejemplo (el de la guía: Lucía Cortés) adaptado a la búsqueda, para
// ver los resultados mientras no hay matching. Se muestra marcado como «Datos
// de ejemplo»
export function getExampleTrip(search: TripSearch): TripResult {
  const campus = `${CAMPUS_NAME} · ${getEntranceName(search.entrance)}`;
  const isToCampus = search.direction === 'to-campus';
  const departureTime = isToCampus
    ? shiftTime(search.time, -(OFFSET_MINUTES + TRIP_MINUTES))
    : shiftTime(search.time, OFFSET_MINUTES);
  return {
    id: 'example-1',
    departureTime,
    arrivalTime: shiftTime(departureTime, TRIP_MINUTES),
    origin: isToCampus ? search.place : campus,
    destination: isToCampus ? campus : search.place,
    driver: { name: 'Lucía Cortés', tripCount: 42, rating: 4.8, isEmailVerified: true },
    freeSeats: 2,
    pickupDetourMinutes: 3,
  };
}
