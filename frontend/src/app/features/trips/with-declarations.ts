import { ModalController } from '@ionic/angular';
import { ApiError } from '../../core/models/api-error.model';
import { DriverService } from '../../core/services/drivers/driver.service';
import { DeclarationDocument, openDeclarationModal } from './declaration-modal/declaration-modal';

export interface DeclarationDeps {
  driver: DriverService;
  modalController: ModalController;
}

// Qué declaración falta según el error de la API
const DECLARATION_BY_CODE: ReadonlyMap<string, DeclarationDocument> = new Map([
  ['DRIVER_DECLARATION_REQUIRED', 'driver_declaration'],
  ['VEHICLE_DECLARATION_REQUIRED', 'vehicle_declaration'],
]);

// Como mucho, las dos declaraciones (la del conductor y la del vehículo)
const MAX_RENEWALS = 2;

// Publica o inicia un viaje (action). Si a la declaración del conductor o a
// la del vehículo le toca renovarse (se aceptó hace más de un año o su texto
// cambió de forma importante), la abre; si el conductor la acepta, la
// registra y vuelve a intentarlo. Si no la acepta, sigue el error (lo explica
// el aviso)
export async function withDeclarations<T>(
  deps: DeclarationDeps,
  vehicleId: string,
  action: () => Promise<T>,
): Promise<T> {
  for (let renewals = 0; ; renewals++) {
    try {
      return await action();
    } catch (error) {
      const document = DECLARATION_BY_CODE.get(ApiError.fromHttpError(error).code);
      if (
        !document ||
        renewals >= MAX_RENEWALS ||
        !(await openDeclarationModal(deps.modalController, document))
      ) {
        throw error;
      }
      await acceptDeclaration(deps.driver, document, vehicleId);
    }
  }
}

async function acceptDeclaration(
  driver: DriverService,
  document: DeclarationDocument,
  vehicleId: string,
): Promise<void> {
  if (document === 'driver_declaration') {
    await driver.acceptDeclaration();
  } else {
    await driver.acceptVehicleDeclaration(vehicleId);
  }
}
