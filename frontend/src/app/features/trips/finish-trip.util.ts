import { ApiError } from '../../core/models/api-error.model';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../core/services/drivers/driver.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { getErrorMessage } from '../../shared/utils/error-message.util';

export interface FinishTripDeps {
  confirm: ConfirmService;
  driver: DriverService;
  tracking: DriverTrackingService;
  toast: ToastService;
}

// «Terminar viaje» (en la tarjeta de Mis viajes y en la pantalla del viaje en
// curso): confirma en azul, termina el viaje y deja de compartir la ubicación.
// true si se ha terminado; si falla, lo dice con un aviso
export async function finishTrip(
  deps: FinishTripDeps,
  tripId: string,
  icon: string,
): Promise<boolean> {
  const accepted = await deps.confirm.ask({
    header: '¿Terminar el viaje?',
    message: 'Dejarás de compartir tu ubicación y el viaje pasará a finalizado.',
    confirmText: 'Terminar',
    cancelText: 'Seguir en el viaje',
    icon,
  });
  if (!accepted) {
    return false;
  }
  try {
    await deps.driver.finishTrip(tripId);
    deps.tracking.stop();
    void deps.toast.showSuccess('Viaje terminado. Gracias por compartir coche.');
    return true;
  } catch (error) {
    void deps.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    return false;
  }
}
