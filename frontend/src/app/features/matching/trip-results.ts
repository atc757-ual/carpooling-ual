import { TripDetail } from '../../core/models/trip-detail.model';
import { TripMatch, TripSearchRequest } from '../../core/models/trip-match.model';
import { TripResult } from '../../core/models/trip-result.model';
import { TripSearch } from '../../core/models/trip-search.model';
import { CAMPUS_NAME } from './campus';

// La hora de un instante ISO en la zona del dispositivo: «07:40»
const TIME_FORMAT = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatTime(isoDateTime: string): string {
  return TIME_FORMAT.format(new Date(isoDateTime));
}

// La búsqueda guardada (fecha y hora locales) como cuerpo de la API
export function toSearchRequest(search: TripSearch): TripSearchRequest {
  return {
    place: { type: 'Point', coordinates: search.place.coordinates },
    parkingId: search.parking.id,
    direction: search.direction,
    desiredAt: new Date(`${search.date}T${search.time}:00`).toISOString(),
    marginMin: search.margin,
    seats: search.seats,
  };
}

const MINUTES_PER_DAY = 24 * 60;

// Minutos entre dos horas «07:40» → «08:12» (32), también si pasa de medianoche
export function minutesBetween(from: string, to: string): number {
  const toMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  return (toMinutes(to) - toMinutes(from) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

// El detalle de un viaje de los resultados, con los datos de la búsqueda: el
// día, el sentido y, como detalle de cada parada, la localidad del pasajero
// y el parking del campus
export function toTripDetail(result: TripResult, search: TripSearch): TripDetail {
  const isToCampus = search.direction === 'to-campus';
  const placeDetail = search.place.locality;
  const campusDetail = search.parking.name;
  return {
    ...result,
    origin: isToCampus ? search.place.name : CAMPUS_NAME,
    destination: isToCampus ? CAMPUS_NAME : search.place.name,
    date: search.date,
    direction: search.direction,
    originDetail: isToCampus ? placeDetail : campusDetail,
    destinationDetail: isToCampus ? campusDetail : placeDetail,
    tripMinutes: minutesBetween(result.departureTime, result.arrivalTime),
  };
}

// Un viaje de la API como fila de resultados: el trayecto sale de la búsqueda
// (la dirección del pasajero y el parking elegido). Todos los usuarios han
// verificado su correo UAL al registrarse; los viajes y la valoración del
// conductor aún no los da la API
export function toTripResult(match: TripMatch, search: TripSearch): TripResult {
  const campus = `${CAMPUS_NAME} · ${search.parking.name}`;
  const isToCampus = search.direction === 'to-campus';
  return {
    id: match.id,
    departureTime: formatTime(match.departureAt),
    arrivalTime: formatTime(match.arrivalAt),
    origin: isToCampus ? search.place.name : campus,
    destination: isToCampus ? campus : search.place.name,
    driver: { name: match.driver.name, isEmailVerified: true },
    freeSeats: match.availableSeats,
    pickupDetourMinutes: match.detourMin,
    vehicle: match.vehicle,
  };
}

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

// «2026-10-27» → «27 oct» (en hora local: new Date('2026-10-27') sería UTC)
export function formatShortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return SHORT_DATE_FORMAT.format(new Date(year, month - 1, day));
}
