import { Translate } from '../../core/i18n/translate';
import { formatTime } from '../matching/trip-results';
import { dateTimeFormat } from '../../core/i18n/app-locale';

// El día de un instante ISO en la zona del dispositivo: «lunes, 16 de noviembre»
const DAY_FORMAT = () =>
  dateTimeFormat({
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

// El trayecto de un viaje, con los nombres que ya se muestran en la app
export interface ShareRoute {
  originName: string | null;
  destinationName: string | null;
  departureAt: string;
}

// Quién conduce y en qué coche (lo que el pasajero aceptado ya ve)
export interface ShareDriver {
  name: string;
  vehicleName: string | null;
  plate: string | null;
}

function routeText({ originName, destinationName }: ShareRoute, translate: Translate): string {
  const origin = originName ?? translate('share.origin');
  return `${origin} → ${destinationName ?? translate('share.destination')}`;
}

// Para las plazas libres (grupos de clase): el trayecto, el día y la hora, y
// dónde pedir plaza. Sin enlace al viaje: su detalle se abre desde una
// búsqueda, así que se invita a buscarlo en la app
export function buildSeatsShareText(
  route: ShareRoute,
  availableSeats: number,
  translate: Translate,
): string {
  const seats = translate(availableSeats === 1 ? 'share.seats.one' : 'share.seats.other', {
    count: availableSeats,
  });
  return translate('share.seatsText', {
    seats,
    route: routeText(route, translate),
    day: DAY_FORMAT().format(new Date(route.departureAt)),
    time: formatTime(route.departureAt),
  });
}

// Para alguien de confianza durante el viaje en curso. Del pasajero, quién
// conduce, el coche y la matrícula; del conductor, solo el trayecto
export function buildLiveShareText(
  route: ShareRoute,
  translate: Translate,
  driver?: ShareDriver,
): string {
  const trip = translate('share.liveTrip', {
    route: routeText(route, translate),
    time: formatTime(route.departureAt),
  });
  if (!driver) {
    return translate('share.liveDriver', { trip });
  }
  const plate = driver.plate && translate('share.plate', { plate: driver.plate });
  const car = [driver.vehicleName, plate].filter(Boolean).join(', ');
  return translate('share.livePassenger', {
    trip,
    name: driver.name,
    car: car ? ` (${car})` : '',
  });
}
