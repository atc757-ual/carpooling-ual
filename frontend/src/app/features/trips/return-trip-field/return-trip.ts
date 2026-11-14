import { PublishTripRequest } from '../../../core/models/driver.model';
import { shiftTime } from '../../matching/trip-search-form/trip-search-form';
import { toIsoDateTime } from '../publish-trip/publish-trip.utils';

// Por defecto la vuelta sale 6 h después de llegar (una mañana de clase)
const DEFAULT_STAY_MINUTES = 6 * 60;

// «08:00» → «14:00», sin pasar de medianoche (el mismo día)
export function defaultReturnTime(arrivalTime: string): string {
  const proposed = shiftTime(arrivalTime, DEFAULT_STAY_MINUTES);
  return proposed > arrivalTime ? proposed : '23:30';
}

// La vuelta (desde el campus) tiene que salir después de llegar a él: las dos
// horas son del mismo día («HH:MM» se compara como texto)
export function isReturnBeforeArrival(arrivalTime: string, returnTime: string): boolean {
  return Boolean(arrivalTime && returnTime) && returnTime <= arrivalTime;
}

// La vuelta en la petición de publicar: el mismo día, a su hora y con sus plazas
export function toReturnTripRequest(
  date: string,
  returnTime: string,
  seats: number,
): NonNullable<PublishTripRequest['returnTrip']> {
  return { departureAt: toIsoDateTime(date, returnTime), offeredSeats: Number(seats) };
}
