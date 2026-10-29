import { Component, inject, Input } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { close, trashOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { Vehicle } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { CONFIRM_ICONS, ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { VehicleForm } from '../vehicle-form/vehicle-form';

// Editar el vehículo (desde Publicar o el Perfil) o, sin vehículo, registrar
// uno nuevo. Al editar solo se cambian los asientos: si el modelo o la
// matrícula están mal, «Eliminar vehículo» (tras confirmarlo). Se abre con
// ModalController (cssClass 'info-dialog', componentProps { vehicle }); cierra
// con el vehículo guardado y el rol 'saved', o con el rol 'removed'
@Component({
  selector: 'app-vehicle-modal',
  imports: [IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar, VehicleForm],
  templateUrl: './vehicle-modal.html',
  styleUrl: './vehicle-modal.scss',
})
export class VehicleModal {
  private readonly modalController = inject(ModalController);
  private readonly driver = inject(DriverService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  // Lo pasa ModalController (componentProps), por eso es un @Input clásico
  @Input() vehicle: Vehicle | null = null;

  protected readonly closeIcon = close;
  protected readonly removeIcon = trashOutline;

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  handleSaved(vehicle: Vehicle): Promise<boolean> {
    return this.modalController.dismiss(vehicle, 'saved');
  }

  // Eliminar (darlo de baja), tras confirmarlo
  async handleRemove(vehicle: Vehicle): Promise<void> {
    const isConfirmed = await this.confirm.ask({
      header: `¿Eliminar ${vehicle.plate}?`,
      message: 'Dejará de salir en tus vehículos y no podrás publicar viajes con él.',
      confirmText: 'Eliminar',
      isDestructive: true,
      icon: CONFIRM_ICONS.remove,
    });
    if (!isConfirmed) {
      return;
    }
    try {
      await this.driver.deactivateVehicle(vehicle.id);
      await this.modalController.dismiss(null, 'removed');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }
}
