import { Component, computed, inject, resource } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { addOutline, carOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { Vehicle } from '../../../core/models/driver.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { VehicleModal } from '../../trips/vehicle-modal/vehicle-modal';
import { MAX_VEHICLES } from '../../trips/vehicle-picker/vehicle-picker';
import { CONFIRM_ICONS, ConfirmService } from '../../../core/services/ui/confirm.service';
import {
  vehicleColorLabel,
  vehicleColorSwatch,
  vehicleDisplayName,
} from '../../../shared/utils/vehicle-display.util';

// «Mis vehículos» del Perfil: cada uno con su matrícula, marca y modelo y
// plazas, y «Editar»; al final, «Registrar vehículo». Los dos abren la ventana
// del vehículo de Publicar. Registrar el primero hace conductor (el backend
// activa el perfil): sin ese perfil aún no hay vehículos que pedir
@Component({
  selector: 'app-profile-vehicles',
  imports: [IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonSpinner],
  templateUrl: './profile-vehicles.html',
  styleUrl: './profile-vehicles.scss',
})
export class ProfileVehicles {
  private readonly driver = inject(DriverService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  readonly vehicles = resource({
    loader: () =>
      this.auth.hasProfile('driver') ? this.driver.listVehicles() : Promise.resolve([]),
  });
  // Los dados de baja no se muestran
  readonly activeVehicles = computed(() =>
    this.vehicles.hasValue()
      ? this.vehicles.value().filter(({ status }) => status !== 'inactive')
      : [],
  );
  // Hasta 3 a la vez (VEHICLE_LIMIT_REACHED)
  readonly canAdd = computed(() => this.activeVehicles().length < MAX_VEHICLES);

  protected readonly carIcon = carOutline;
  protected readonly addIcon = addOutline;

  // La API cuenta las plazas sin el conductor
  protected details(vehicle: Vehicle): string {
    const seats = `hasta ${vehicle.capacity} ${vehicle.capacity === 1 ? 'pasajero' : 'pasajeros'}`;
    return `${vehicleDisplayName(vehicle)} · ${vehicleColorLabel(vehicle.color)} · ${seats}`;
  }

  protected colorSwatch(vehicle: Vehicle): string {
    return vehicleColorSwatch(vehicle.color);
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
      this.vehicles.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  // Sin vehículo, registra uno nuevo
  async handleOpen(vehicle: Vehicle | null): Promise<void> {
    const modal = await this.modalController.create({
      component: VehicleModal,
      cssClass: 'info-dialog',
      componentProps: { vehicle },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      // El primero acaba de hacerle conductor: el token nuevo lo lleva
      if (!this.auth.hasProfile('driver')) {
        await this.auth.refreshAccessToken().catch(() => undefined);
      }
      this.vehicles.reload();
    }
  }
}
