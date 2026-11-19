import { Translate } from '../../core/i18n/translate';
import { ApiError } from '../../core/models/api-error.model';
import { GeoPoint } from '../../core/models/place.model';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../core/services/drivers/driver.service';
import { LocationError, LocationService } from '../../core/services/location/location.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { getErrorMessage } from '../../shared/utils/error-message.util';
import { distanceMeters } from './passenger-requests/live-trip-map/live-trip-map.utils';
import { numberFormat } from '../../core/i18n/app-locale';

// Más lejos que esto del destino, se avisa antes de terminar (no se impide:
// el GPS puede fallar o el viaje acabar antes por algo justificado)
export const FINISH_GEOFENCE_METERS = 300;

export interface FinishTripDeps {
  confirm: ConfirmService;
  driver: DriverService;
  tracking: DriverTrackingService;
  toast: ToastService;
  location: LocationService;
  translate: Translate;
}

export interface FinishableTrip {
  id: string;
  destination: GeoPoint;
}

const DISTANCE_FORMAT = () => numberFormat({ maximumFractionDigits: 1 });

// «250 m», «2,3 km»
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${DISTANCE_FORMAT().format(Math.round(meters / 100) / 10)} km`;
}

// Dónde está el conductor; null si no se sabe (sin permiso, sin GPS…)
async function currentPoint(location: LocationService): Promise<[number, number] | null> {
  try {
    return await location.getCurrentPoint('driving');
  } catch (error) {
    if (error instanceof LocationError) {
      return null;
    }
    throw error;
  }
}

// Dónde está el conductor al pulsar «Terminar viaje» y si está lejos del
// destino (más de 300 m). Sin posición, distancia null y no se avisa
export interface FinishCheck {
  point: [number, number] | null;
  distance: number | null;
  isFar: boolean;
}

export async function checkFinish(
  location: LocationService,
  trip: FinishableTrip,
): Promise<FinishCheck> {
  const point = await currentPoint(location);
  const distance = point ? distanceMeters(point, trip.destination.coordinates) : null;
  return { point, distance, isFar: distance !== null && distance > FINISH_GEOFENCE_METERS };
}

// Termina el viaje con su posición (la API guarda a cuántos metros del
// destino) y deja de compartir la ubicación. true si se ha terminado; si
// falla, lo dice con un aviso
export async function completeFinish(
  deps: Pick<FinishTripDeps, 'driver' | 'tracking' | 'toast' | 'translate'>,
  tripId: string,
  point: [number, number] | null,
): Promise<boolean> {
  try {
    await deps.driver.finishTrip(tripId, point);
    deps.tracking.stop();
    void deps.toast.showSuccess(deps.translate('live.finish.done'));
    return true;
  } catch (error) {
    void deps.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    return false;
  }
}

// «Terminar viaje» con diálogo (en la tarjeta de Mis viajes; la pantalla del
// viaje en curso lo pregunta en su propia tarjeta): si el conductor está a
// más de 300 m del destino, avisa en ámbar con la distancia (lo principal es
// seguir en el viaje); si no, confirma en azul. true si se ha terminado
export async function finishTrip(
  deps: FinishTripDeps,
  trip: FinishableTrip,
  icon: string,
): Promise<boolean> {
  const { point, distance, isFar } = await checkFinish(deps.location, trip);
  const t = deps.translate;
  const accepted = await deps.confirm.ask(
    isFar && distance !== null
      ? {
          header: t('live.finish.farHeader'),
          message: `${t('live.stillFar', { distance: formatDistance(distance) })} ${t('live.terminasAhoraTusPasajeros')}`,
          confirmText: t('live.finishAnyway'),
          cancelText: t('live.seguirViaje'),
          isWarning: true,
        }
      : {
          header: t('live.terminarViaje'),
          message: t('live.dejarasCompartirUbicacionViaje'),
          confirmText: t('live.terminar'),
          cancelText: t('live.seguirViaje'),
          icon,
        },
  );
  return accepted ? completeFinish(deps, trip.id, point) : false;
}
