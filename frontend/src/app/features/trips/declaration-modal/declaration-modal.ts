import { Component, inject } from '@angular/core';
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

// Lo que el conductor declara antes de su primer viaje (RF-21). Se abre con
// ModalController (cssClass 'info-dialog'); «Acepto la declaración» cierra con
// el rol 'accept' y la X, con el de por defecto
@Component({
  selector: 'app-declaration-modal',
  imports: [IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar],
  templateUrl: './declaration-modal.html',
  styleUrl: './declaration-modal.scss',
})
export class DeclarationModal {
  private readonly modalController = inject(ModalController);

  protected readonly closeIcon = close;

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }

  accept(): Promise<boolean> {
    return this.modalController.dismiss(true, 'accept');
  }
}
