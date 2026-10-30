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
export function toDepartureAt(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

// «mié, 28 oct» para el resumen
export function formatDateLabel(date: string): string {
  return date ? DATE_LABEL.format(new Date(`${date}T00:00:00`)) : '';
}

// Paradas del viaje (RouteTimeline): la hora de salida y la de llegada
// aproximada (sin desvíos, ver trip-impact.ts), en un sentido u otro
export function buildStops(
  place: SearchPlace,
  parking: CampusParking,
  { isToCampus, time }: { isToCampus: boolean; time: string },
): RouteStop[] {
  const arrival = shiftTime(
    time,
    estimateDurationMin(place.coordinates, parking.location.coordinates),
  );
  const campus: RouteStop = { name: CAMPUS_NAME, detail: parking.name };
  const outside: RouteStop = { name: place.name, detail: place.locality };
  return isToCampus
    ? [
        { ...outside, time },
        { ...campus, time: arrival },
      ]
    : [
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
    departureAt: toDepartureAt(offer.date, offer.time),
    offeredSeats: Number(offer.seats),
    maxDetourMin: offer.maxDetourMin,
    originName: isToCampus ? place.name : campusName,
    destinationName: isToCampus ? campusName : place.name,
  };
}
