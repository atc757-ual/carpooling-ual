import { Translate } from '../../../core/i18n/translate';
import { SharedTrip } from '../../../core/models/trip-share.model';
import { formatPlate } from '../../../shared/utils/vehicle-display.util';
import { RoutePoint } from '../../../shared/components/ui/trip-route-map/trip-route-map';

// Sin posición nueva desde hace más de esto, se avisa de que no es en directo
export const STALE_POSITION_MS = 60_000;

export type SharedTripTone = 'info' | 'success' | 'neutral';

export interface SharedTripStatus {
  title: string;
  description: string;
  tone: SharedTripTone;
}

// El estado del pasajero en una frase, para quien sigue el viaje
export function describeSharedTrip(trip: SharedTrip, translate: Translate): SharedTripStatus {
  if (trip.tripStatus === 'cancelled') {
    return {
      title: translate('sharedTrip.status.cancelledTitle'),
      description: translate('sharedTrip.status.cancelledText'),
      tone: 'neutral',
    };
  }
  if (trip.passengerState === 'finished') {
    return {
      title: translate('sharedTrip.status.finishedTitle'),
      description: translate('sharedTrip.status.finishedText'),
      tone: 'success',
    };
  }
  if (trip.passengerState === 'on_board') {
    return {
      title: translate('sharedTrip.status.onBoardTitle'),
      description: translate('sharedTrip.status.onBoardText'),
      tone: 'success',
    };
  }
  return {
    title: translate('sharedTrip.status.waitingTitle'),
    description: translate(
      trip.tripStatus === 'in_progress'
        ? 'sharedTrip.status.waitingStartedText'
        : 'sharedTrip.status.waitingNotStartedText',
    ),
    tone: 'info',
  };
}

// «Seat Ibiza · Rojo · 1234 ABC» (el color, en el idioma de la app), con lo
// que se sepa
export function describeSharedVehicle(
  vehicle: SharedTrip['vehicle'],
  language = 'es',
): string | null {
  if (vehicle === null) {
    return null;
  }
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ');
  const plate = vehicle.plate ? formatPlate(vehicle.plate) : null;
  const color = language === 'en' ? vehicle.colorNameEn : vehicle.colorName;
  const parts = [name, color, plate].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// Los extremos del recorrido para el mapa (la salida y el destino son el
// principio y el final de la ruta)
export function routeEnds(
  route: NonNullable<SharedTrip['route']>,
  destinationName: string | null,
  translate: Translate,
): { origin: RoutePoint; destination: RoutePoint } | null {
  const coordinates = route.coordinates;
  if (coordinates.length < 2) {
    return null;
  }
  return {
    origin: { coordinates: coordinates[0], label: translate('sharedTrip.start') },
    destination: {
      coordinates: coordinates.at(-1) ?? coordinates[0],
      label: destinationName ?? translate('sharedTrip.destino'),
    },
  };
}

export function isPositionStale(recordedAt: string, now: number): boolean {
  return now - Date.parse(recordedAt) > STALE_POSITION_MS;
}
