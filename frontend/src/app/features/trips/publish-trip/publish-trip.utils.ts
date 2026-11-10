import { PublishTripRequest } from '../../../core/models/driver.model';
import { CampusParking } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { RouteStop } from '../../../shared/components/ui/route-timeline/route-timeline';
import { CAMPUS_NAME } from '../../matching/campus';
import { estimateDurationMin, estimateTripImpact } from '../../matching/trip-impact';
import { shiftTime } from '../../matching/trip-search-form/trip-search-form';

const DATE_LABEL = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

// Lo que se ahorra si se llenan las plazas
export interface DriverImpact {
  seats: number;
  km: number;
  co2Kg: number;
}

// Fecha y hora locales («2026-10-27», «07:40») en ISO UTC para la API
export function toIsoDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// «mié, 28 oct» para el resumen
export function formatDateLabel(date: string): string {
  return date ? DATE_LABEL.format(new Date(`${date}T00:00:00`)) : '';
}

// La hora que elige el conductor: hacia el campus, la de llegada (como muy
// tarde); desde el campus, la de salida
export interface TripTime {
  isToCampus: boolean;
  time: string;
  maxDetourMin: number;
}

// Hacia el campus, la salida aproximada para llegar a tiempo aunque recoja a
// alguien: la llegada menos el trayecto y el desvío máximo. El backend la
// calcula con la ruta real al publicar
export function estimateDepartureTime(
  place: SearchPlace,
  parking: CampusParking,
  { time, maxDetourMin }: Pick<TripTime, 'time' | 'maxDetourMin'>,
): string {
  const durationMin = estimateDurationMin(place.coordinates, parking.location.coordinates);
  return shiftTime(time, -(durationMin + maxDetourMin));
}

// La misma salida aproximada, como fecha completa: si la llegada es poco
// después de medianoche, la salida es del día anterior (la hora sola no lo dice)
export function estimateDepartureAt(
  place: SearchPlace,
  parking: CampusParking,
  { date, time, maxDetourMin }: Pick<TripTime, 'time' | 'maxDetourMin'> & { date: string },
): Date {
  const durationMin = estimateDurationMin(place.coordinates, parking.location.coordinates);
  const arrival = new Date(`${date}T${time}:00`);
  return new Date(arrival.getTime() - (durationMin + maxDetourMin) * 60_000);
}

// Paradas del viaje (RouteTimeline) en un sentido u otro: hacia el campus, la
// salida aproximada (o la real, ya publicado) y la llegada elegida; desde el
// campus, la salida elegida y la llegada aproximada (sin desvíos)
export function buildStops(
  place: SearchPlace,
  parking: CampusParking,
  tripTime: TripTime & { departureTime?: string },
): RouteStop[] {
  const { isToCampus, time } = tripTime;
  const campus: RouteStop = { name: CAMPUS_NAME, detail: parking.name };
  const outside: RouteStop = { name: place.name, detail: place.locality };
  if (isToCampus) {
    const departure = tripTime.departureTime ?? estimateDepartureTime(place, parking, tripTime);
    return [
      { ...outside, time: departure },
      { ...campus, time },
    ];
  }
  const arrival = shiftTime(
    time,
    estimateDurationMin(place.coordinates, parking.location.coordinates),
  );
  return [
    { ...campus, time },
    { ...outside, time: arrival },
  ];
}

// Cada pasajero deja su coche en casa: el ahorro de un trayecto por las
// plazas (aproximado: ver trip-impact.ts); null si no hay nada que ahorrar
export function estimateDriverImpact(
  place: SearchPlace,
  parking: CampusParking,
  seats: number,
): DriverImpact | null {
  const trip = estimateTripImpact(place.coordinates, parking.location.coordinates);
  return trip
    ? { seats, km: trip.km * seats, co2Kg: Math.round(trip.co2Kg * seats * 10) / 10 }
    : null;
}

// Lo que se publica, además de la dirección y el parking
export interface TripOffer {
  isToCampus: boolean;
  date: string;
  time: string;
  vehicleId: string;
  seats: number;
  maxDetourMin: number;
}

// La petición de la API: origen y destino en GeoJSON, en un sentido u otro, y
// sus nombres («Universidad de Almería · P1» para el campus)
export function toPublishTripRequest(
  place: SearchPlace,
  parking: CampusParking,
  offer: TripOffer,
): PublishTripRequest {
  const placePoint = { type: 'Point' as const, coordinates: place.coordinates };
  const campusName = `${CAMPUS_NAME} · ${parking.name}`;
  const { isToCampus } = offer;
  return {
    vehicleId: offer.vehicleId,
    origin: isToCampus ? placePoint : parking.location,
    destination: isToCampus ? parking.location : placePoint,
    ...(isToCampus
      ? { arrivalAt: toIsoDateTime(offer.date, offer.time) }
      : { departureAt: toIsoDateTime(offer.date, offer.time) }),
    offeredSeats: Number(offer.seats),
    maxDetourMin: offer.maxDetourMin,
    originName: isToCampus ? place.name : campusName,
    destinationName: isToCampus ? campusName : place.name,
  };
}
