import { formatTime } from '../matching/trip-results';

// El día de un instante ISO en la zona del dispositivo: «lunes, 16 de noviembre»
const DAY_FORMAT = new Intl.DateTimeFormat('es-ES', {
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

function routeText({ originName, destinationName }: ShareRoute): string {
  return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
}

// Para las plazas libres (grupos de clase): el trayecto, el día y la hora, y
// dónde pedir plaza. Sin enlace al viaje: su detalle se abre desde una
// búsqueda, así que se invita a buscarlo en la app
export function buildSeatsShareText(route: ShareRoute, availableSeats: number): string {
  const seats = availableSeats === 1 ? '1 plaza libre' : `${availableSeats} plazas libres`;
  const day = DAY_FORMAT.format(new Date(route.departureAt));
  return (
    `Tengo ${seats} en mi coche: ${routeText(route)}, el ${day} a las ` +
    `${formatTime(route.departureAt)}. Búscalo en Carpooling UAL y pide tu plaza.`
  );
}

// Para alguien de confianza durante el viaje en curso. Del pasajero, quién
// conduce, el coche y la matrícula; del conductor, solo el trayecto
export function buildLiveShareText(route: ShareRoute, driver?: ShareDriver): string {
  const trip = `${routeText(route)}, salida a las ${formatTime(route.departureAt)}`;
  if (!driver) {
    return `Voy conduciendo un viaje compartido de la UAL: ${trip}.`;
  }
  const car = [driver.vehicleName, driver.plate && `matrícula ${driver.plate}`]
    .filter(Boolean)
    .join(', ');
  const carText = car ? ` (${car})` : '';
  return `Voy en un viaje compartido de la UAL: ${trip}. Conduce ${driver.name}${carText}.`;
}
