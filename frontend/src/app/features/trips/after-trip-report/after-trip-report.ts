import { Component, inject, input, signal } from '@angular/core';
import { IonCard, IonCardContent, IonIcon, ModalController } from '@ionic/angular';
import { documentTextOutline } from 'ionicons/icons';
import { ToastService } from '../../../core/services/ui/toast.service';
import { RevealOnTouch } from '../../../shared/directives/reveal-on-touch.directive';
import { PassengerIncidentModal } from '../passenger-requests/passenger-incident-modal/passenger-incident-modal';

// «¿Algo fue mal?» en el detalle de un viaje ya realizado (conductor o
// pasajero): abre el formulario de la incidencia en su ventana, sin cancelar
// nada. La API solo lo admite en los 7 días siguientes a terminar
@Component({
  selector: 'app-after-trip-report',
  imports: [IonCard, IonCardContent, IonIcon, RevealOnTouch],
  template: `
    <ion-card class="after-trip-report">
      <ion-card-content>
        <div class="section-item">
          <div class="section-item__text">
            <h2 class="section-item__title">¿Algo fue mal?</h2>
            <p class="section-item__subtitle">
              @if (isSent()) {
                Gracias: lo revisará un administrador.
              } @else {
                Repórtalo en los 7 días siguientes: lo revisará un administrador.
              }
            </p>
          </div>
          @if (!isSent()) {
            <button
              type="button"
              class="icon-btn icon-btn--reveal"
              appRevealOnTouch
              aria-label="Reportar el viaje: abre el formulario"
              (click)="handleReport()"
            >
              <ion-icon [icon]="reportIcon" aria-hidden="true" />
              <span class="icon-btn__label" aria-hidden="true">Reportar</span>
            </button>
          }
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: `
    :host {
      display: block;
    }

    .after-trip-report {
      margin: 0;
    }
  `,
})
export class AfterTripReport {
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);

  readonly tripId = input.required<string>();
  readonly isDriver = input(false);
  readonly isSent = signal(false);

  protected readonly reportIcon = documentTextOutline;

  async handleReport(): Promise<void> {
    const modal = await this.modalController.create({
      component: PassengerIncidentModal,
      componentProps: { tripId: this.tripId(), isDriver: this.isDriver(), isAfterTrip: true },
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      this.isSent.set(true);
      void this.toast.showSuccess('Reporte enviado: lo revisará un administrador.');
    }
  }
}
