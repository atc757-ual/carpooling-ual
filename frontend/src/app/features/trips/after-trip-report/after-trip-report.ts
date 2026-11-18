import { Component, inject, input, signal } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular';
import { documentTextOutline } from 'ionicons/icons';
import { ToastService } from '../../../core/services/ui/toast.service';
import { RevealOnTouch } from '../../../shared/directives/reveal-on-touch.directive';
import { PassengerIncidentModal } from '../passenger-requests/passenger-incident-modal/passenger-incident-modal';

// Hasta cuándo se puede reportar un viaje ya realizado (la API lo admite
// en los 7 días siguientes a terminar)
const REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function isAfterTripReportOpen(
  { status, finishedAt }: { status: string; finishedAt?: string | null },
  now = Date.now(),
): boolean {
  return (
    status === 'finished' &&
    !!finishedAt &&
    now <= new Date(finishedAt).getTime() + REPORT_WINDOW_MS
  );
}

// «¿Algo fue mal?» en el detalle de un viaje ya realizado (conductor o
// pasajero): abre el formulario de la incidencia en su ventana, sin cancelar
// nada. La API solo lo admite en los 7 días siguientes a terminar. Va dentro
// de la tarjeta de acciones, bajo «Este viaje ya terminó»
@Component({
  selector: 'app-after-trip-report',
  imports: [IonIcon, RevealOnTouch],
  template: `
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
  `,
  styles: `
    :host {
      display: block;
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
