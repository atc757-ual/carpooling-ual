import { TripRoute } from '../../core/models/trip-route.model';
import { formatTime } from '../matching/trip-results';

const MINUTE_MS = 60_000;

// La llegada aproximada de un viaje («08:19»): la de la API, que cuenta el
// inicio real y el tiempo parado en cada recogida; terminado o cancelado, la
// API ya no la da y se estima con la salida y la duración de la ruta. Sin la
// ruta (aún cargando), nada
export function formatRouteArrival(
  departureAt: string,
  route: Pick<TripRoute, 'durationMin' | 'estimatedArrivalAt'> | null | undefined,
): string | undefined {
  if (!route) {
    return undefined;
  }
  const arrivalAt =
    route.estimatedArrivalAt ??
    new Date(Date.parse(departureAt) + route.durationMin * MINUTE_MS).toISOString();
  return formatTime(arrivalAt);
}
