import { ModalController } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { PublishedTrip, PublishTripRequest } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { openDeclarationModal } from '../declaration-modal/declaration-modal';

export interface PublishDeps {
  driver: DriverService;
  modalController: ModalController;
}

// Publica el viaje. Si el vehículo no tiene al día su declaración (seguro e
// ITV: su texto cambió de forma importante, VEHICLE_DECLARATION_REQUIRED), la
// abre; si el conductor la acepta, la registra para ese vehículo y vuelve a
// publicar. Si no la acepta, sigue el error (lo explica el aviso)
export async function publishWithVehicleDeclaration(
  deps: PublishDeps,
  request: PublishTripRequest,
): Promise<PublishedTrip> {
  try {
    return await deps.driver.publishTrip(request);
  } catch (error) {
    const isMissing = ApiError.fromHttpError(error).code === 'VEHICLE_DECLARATION_REQUIRED';
    if (!isMissing || !(await openDeclarationModal(deps.modalController, 'vehicle_declaration'))) {
      throw error;
    }
    await deps.driver.acceptVehicleDeclaration(request.vehicleId);
    return deps.driver.publishTrip(request);
  }
}
