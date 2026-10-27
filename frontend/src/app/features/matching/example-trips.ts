import { TripDetail } from '../../core/models/trip-detail.model';
import { TripResult } from '../../core/models/trip-result.model';
import { TripSearch } from '../../core/models/trip-search.model';
import { CAMPUS_NAME } from './campus';
import { shiftTime } from './trip-search-form/trip-search-form';

const EXAMPLE_TRIP_ID = 'example-1';

// Duración del viaje de ejemplo y cuánto antes de la hora pedida llega (o
// cuánto después sale, al volver)
const TRIP_MINUTES = 32;
const OFFSET_MINUTES = 8;

// Viaje de ejemplo (el de la guía: Lucía Cortés) adaptado a la búsqueda, para
// ver los resultados mientras no hay matching. Se muestra marcado como «Datos
// de ejemplo»
export function getExampleTrip(search: TripSearch): TripResult {
  const campus = `${CAMPUS_NAME} · ${search.parking.name}`;
  const isToCampus = search.direction === 'to-campus';
  const departureTime = isToCampus
    ? shiftTime(search.time, -(OFFSET_MINUTES + TRIP_MINUTES))
    : shiftTime(search.time, OFFSET_MINUTES);
  return {
    id: EXAMPLE_TRIP_ID,
    departureTime,
    arrivalTime: shiftTime(departureTime, TRIP_MINUTES),
    origin: isToCampus ? search.place.name : campus,
    destination: isToCampus ? campus : search.place.name,
    driver: { name: 'Lucía Cortés', tripCount: 42, rating: 4.8, isEmailVerified: true },
    freeSeats: 2,
    pickupDetourMinutes: 3,
  };
}

// El mismo viaje, completo, para su detalle: con las mismas horas que en los
// resultados. Sin búsqueda o con otro id, no hay viaje (null)
export function getExampleTripDetail(id: string, search: TripSearch | null): TripDetail | null {
  if (id !== EXAMPLE_TRIP_ID || !search) {
    return null;
  }
  const isToCampus = search.direction === 'to-campus';
  const place = { name: search.place.name, detail: isToCampus ? 'Recogida' : 'Llegada' };
  const campus = { name: CAMPUS_NAME, detail: search.parking.name };
  const [origin, destination] = isToCampus ? [place, campus] : [campus, place];
  return {
    ...getExampleTrip(search),
    date: search.date,
    direction: search.direction,
    origin: origin.name,
    originDetail: origin.detail,
    destination: destination.name,
    destinationDetail: destination.detail,
    tripMinutes: TRIP_MINUTES,
    vehicle: { model: 'Seat Ibiza', plate: '1234 BCD', preferences: ['No fumar', 'Música suave'] },
  };
}
