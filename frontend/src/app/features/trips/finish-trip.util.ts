import { ApiError } from '../../core/models/api-error.model';
import { GeoPoint } from '../../core/models/place.model';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../core/services/drivers/driver.service';
import { LocationService } from '../../core/services/location/location.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { getErrorMessage } from '../../shared/utils/error-message.util';
import { distanceMeters } from './passenger-requests/live-trip-map/live-trip-map.utils';

// Más lejos que esto del destino, se avisa antes de terminar (no se impide:
// el GPS puede fallar o el viaje acabar antes por algo justificado)
export const FINISH_GEOFENCE_METERS = 300;

export interface FinishTripDeps {
  confirm: ConfirmService;
  driver: DriverService;
  tracking: DriverTrackingService;
  toast: ToastService;
  location: LocationService;
}

export interface FinishableTrip {
  id: string;
  destination: GeoPoint;
}

const DISTANCE_FORMAT = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

// «250 m», «2,3 km»
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${DISTANCE_FORMAT.format(Math.round(meters / 100) / 10)} km`;
}

// Dónde está el conductor; null si no se sabe (sin permiso, sin GPS…)
async function currentPoint(location: LocationService): Promise<[number, number] | null> {
  try {
    return await location.getCurrentPoint('driving');
  } catch {
    return null;
  }
}

// «Terminar viaje» (en la tarjeta de Mis viajes y en la pantalla del viaje en
// curso): si el conductor está a más de 300 m del destino, avisa en ámbar con
// la distancia (lo principal es seguir en el viaje); si no, confirma en azul.
// Termina el viaje con su posición (la API guarda a cuántos metros del
// destino) y deja de compartir la ubicación. true si se ha terminado; si
// falla, lo dice con un aviso
export async function finishTrip(
  deps: FinishTripDeps,
  trip: FinishableTrip,
  icon: string,
): Promise<boolean> {
  const point = await currentPoint(deps.location);
  const distance = point ? distanceMeters(point, trip.destination.coordinates) : null;
  const isFar = distance !== null && distance > FINISH_GEOFENCE_METERS;
  const accepted = await deps.confirm.ask(
    isFar
      ? {
          header: '¿Terminar lejos del destino?',
          message: `Aún estás a ${formatDistance(distance)} del destino. Si terminas ahora, tus pasajeros verán el viaje como finalizado.`,
          confirmText: 'Terminar igualmente',
          cancelText: 'Seguir en el viaje',
          isDestructive: true,
          isWarning: true,
        }
      : {
          header: '¿Terminar el viaje?',
          message: 'Dejarás de compartir tu ubicación y el viaje pasará a finalizado.',
          confirmText: 'Terminar',
          cancelText: 'Seguir en el viaje',
          icon,
        },
  );
  if (!accepted) {
    return false;
  }
  try {
    await deps.driver.finishTrip(trip.id, point);
    deps.tracking.stop();
    void deps.toast.showSuccess('Viaje terminado. Gracias por compartir coche.');
    return true;
  } catch (error) {
    void deps.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    return false;
  }
}
