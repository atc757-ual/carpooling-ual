import { DriverTrip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { RouteStop } from '../../../shared/components/ui/route-timeline/route-timeline';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { formatTime } from '../../matching/trip-results';

// «Ana», «Ana y Leo», «Ana, Leo y Pía»
function joinNames(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

// Las paradas del recorrido del conductor: su salida, dónde recoge y la
// llegada. En paradas, cada una con su hora y quién sube; en el camino, el
// punto de cada pasajero aceptado con su hora de recogida
export function buildDriverRouteStops(
  trip: Pick<DriverTrip, 'departureAt' | 'originName' | 'destinationName' | 'stops'>,
  accepted: readonly SeatRequest[],
  durationMin: number | undefined,
): RouteStop[] {
  const arrival =
    durationMin === undefined
      ? undefined
      : formatTime(new Date(Date.parse(trip.departureAt) + durationMin * 60_000).toISOString());
  const pickups =
    trip.stops.length > 0
      ? trip.stops.map<RouteStop>((stop) => {
          const boarding = accepted
            .filter(({ stopId }) => stopId === stop.id)
            .map(({ passenger }) => getFirstName(passenger.name));
          return {
            name: stop.name,
            detail:
              boarding.length > 0 ? `Recoges a ${joinNames(boarding)}` : 'Aún no sube nadie aquí',
            time: formatTime(stop.estimatedAt),
          };
        })
      : accepted.map<RouteStop>((request) => ({
          name: request.pickupName ?? 'Punto de recogida',
          detail: `Recoges a ${getFirstName(request.passenger.name)}`,
          ...(request.pickupAt && { time: formatTime(request.pickupAt) }),
        }));
  return [
    {
      name: trip.originName ?? 'Salida',
      detail: 'Sales de aquí',
      time: formatTime(trip.departureAt),
    },
    ...pickups,
    { name: trip.destinationName ?? 'Destino', detail: 'Llegada aproximada', time: arrival },
  ];
}
