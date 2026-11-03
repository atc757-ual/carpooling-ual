import { Component, inject, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { Vehicle } from '../../../core/models/driver.model';
import { ToastService } from '../../../core/services/ui/toast.service';
import { VehicleForm } from '../vehicle-form/vehicle-form';

// Registrar un vehículo o editar uno (desde Publicar o el Perfil). Al editar
// solo se cambian los asientos: si el modelo o la matrícula están mal, se
// elimina desde su tarjeta y se registra de nuevo. Se abre con
// ModalController (cssClass 'info-dialog', componentProps { vehicle }); al
// guardar avisa en verde y cierra con el vehículo y el rol 'saved'
@Component({
  selector: 'app-vehicle-modal',
  imports: [ModalHeader, VehicleForm],
  templateUrl: './vehicle-modal.html',
})
export class VehicleModal {
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);

  // Lo pasa ModalController (componentProps), por eso es un @Input clásico
  @Input() vehicle: Vehicle | null = null;

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  handleSaved(vehicle: Vehicle): Promise<boolean> {
    void this.toast.showSuccess(this.vehicle ? 'Vehículo actualizado.' : 'Vehículo registrado.');
    return this.modalController.dismiss(vehicle, 'saved');
  }
}
