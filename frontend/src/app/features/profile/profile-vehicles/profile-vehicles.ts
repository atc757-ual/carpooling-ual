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
import { Vehicle } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { VehicleModal } from '../../trips/vehicle-modal/vehicle-modal';

// «Mis vehículos» del Perfil (solo con el perfil de conductor): cada uno con su
// matrícula, marca y modelo y plazas, y «Editar»; al final, «Registrar
// vehículo». Los dos abren la ventana del vehículo de Publicar
@Component({
  selector: 'app-profile-vehicles',
  imports: [IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonSpinner],
  templateUrl: './profile-vehicles.html',
  styleUrl: './profile-vehicles.scss',
})
export class ProfileVehicles {
  private readonly driver = inject(DriverService);
  private readonly modalController = inject(ModalController);

  readonly vehicles = resource({ loader: () => this.driver.listVehicles() });
  // Los dados de baja no se muestran
  readonly activeVehicles = computed(() =>
    this.vehicles.hasValue()
      ? this.vehicles.value().filter(({ status }) => status !== 'inactive')
      : [],
  );

  protected readonly carIcon = carOutline;
  protected readonly addIcon = addOutline;

  // «Seat León · hasta 3 pasajeros» (la API cuenta las plazas sin el conductor)
  protected details(vehicle: Vehicle): string {
    const seats = `hasta ${vehicle.capacity} ${vehicle.capacity === 1 ? 'pasajero' : 'pasajeros'}`;
    return vehicle.model ? `${vehicle.model} · ${seats}` : seats;
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
      this.vehicles.reload();
    }
  }
}
