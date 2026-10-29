import { Component, inject, signal } from '@angular/core';
import { IonButton, IonIcon, ModalController } from '@ionic/angular';
import { navigateCircleOutline } from 'ionicons/icons';
import { LocationService } from '../../../core/services/location/location.service';

// Al entrar con sesión y sin haber decidido aún sobre la ubicación: para qué
// la usamos y el permiso. «Permitir ubicación» hace que el navegador (o el
// móvil) lo pida; «Ahora no» cierra y no se vuelve a ofrecer en este
// dispositivo. Se abre con ModalController (cssClass 'info-dialog'); cierra
// con el rol 'allowed' o 'later'
@Component({
  selector: 'app-location-permission-modal',
  imports: [IonButton, IonIcon],
  templateUrl: './location-permission-modal.html',
  styleUrl: './location-permission-modal.scss',
})
export class LocationPermissionModal {
  private readonly modalController = inject(ModalController);
  private readonly location = inject(LocationService);

  readonly isAsking = signal(false);
  protected readonly icon = navigateCircleOutline;

  // Pedir la ubicación una vez es lo que hace que se pida el permiso; aunque
  // se deniegue, la ventana se cierra (la app sigue sin ella)
  async handleAllow(): Promise<void> {
    this.isAsking.set(true);
    await this.location.getCurrentPoint().catch(() => undefined);
    await this.modalController.dismiss(null, 'allowed');
  }

  handleLater(): Promise<boolean> {
    return this.modalController.dismiss(null, 'later');
  }
}
