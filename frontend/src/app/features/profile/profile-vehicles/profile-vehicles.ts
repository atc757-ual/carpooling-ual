import { Component, computed, inject, OnInit, resource, signal } from '@angular/core';
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
import { TranslocoPipe } from '@jsverse/transloco';
import { addOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { Vehicle } from '../../../core/models/driver.model';
import { PreferencesPlugin } from '../../../core/plugins/preferences-plugin';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { VehicleCard } from '../../../shared/components/ui/vehicle-card/vehicle-card';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { VehicleModal } from '../../trips/vehicle-modal/vehicle-modal';
import { DEFAULT_VEHICLE_KEY, MAX_VEHICLES } from '../../trips/vehicle-picker/vehicle-picker';
import { CONFIRM_ICONS, ConfirmService } from '../../../core/services/ui/confirm.service';

// «Mis vehículos» del Perfil: una tarjeta por vehículo (la misma que en
// Publicar). Pulsarla lo deja como predeterminado (el que sale elegido al
// publicar, en este dispositivo); a la derecha, editar y eliminar; arriba,
// «Registrar vehículo». Registrar el primero hace conductor (el backend activa
// el perfil): sin ese perfil aún no hay vehículos que pedir
@Component({
  selector: 'app-profile-vehicles',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    VehicleCard,
    TranslocoPipe,
  ],
  templateUrl: './profile-vehicles.html',
  styleUrl: './profile-vehicles.scss',
})
export class ProfileVehicles implements OnInit {
  private readonly driver = inject(DriverService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);
  private readonly preferences = inject(PreferencesPlugin);

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

  // El predeterminado guardado; sin él (o si ya no está), el primero
  private readonly savedDefaultId = signal<string | null>(null);
  readonly defaultId = computed(() => {
    const vehicles = this.activeVehicles();
    const saved = this.savedDefaultId();
    return vehicles.some(({ id }) => id === saved) ? saved : (vehicles[0]?.id ?? null);
  });

  protected readonly addIcon = addOutline;

  ngOnInit(): void {
    void this.preferences
      .get(DEFAULT_VEHICLE_KEY)
      .then((id) => this.savedDefaultId.set(id))
      .catch(() => undefined);
  }

  handleSetDefault(vehicle: Vehicle): void {
    this.savedDefaultId.set(vehicle.id);
    void this.preferences.set(DEFAULT_VEHICLE_KEY, vehicle.id).catch(() => undefined);
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
