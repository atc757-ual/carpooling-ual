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
import { close } from 'ionicons/icons';
import { Vehicle } from '../../../core/models/driver.model';
import { VehicleForm } from '../vehicle-form/vehicle-form';

// Editar el vehículo (desde Publicar o el Perfil) o, sin vehículo, registrar
// uno nuevo (Perfil). Se abre con ModalController (cssClass
// 'info-dialog', componentProps { vehicle }); al guardar cierra con el
// vehículo guardado y el rol 'saved'
@Component({
  selector: 'app-vehicle-modal',
  imports: [IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar, VehicleForm],
  templateUrl: './vehicle-modal.html',
  styleUrl: './vehicle-modal.scss',
})
export class VehicleModal {
  private readonly modalController = inject(ModalController);

  // Lo pasa ModalController (componentProps), por eso es un @Input clásico
  @Input() vehicle: Vehicle | null = null;

  protected readonly closeIcon = close;

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  handleSaved(vehicle: Vehicle): Promise<boolean> {
    return this.modalController.dismiss(vehicle, 'saved');
  }
}
