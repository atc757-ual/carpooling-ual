import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, inject, input, signal } from '@angular/core';
import { IonIcon, ModalController } from '@ionic/angular';
import { documentTextOutline } from 'ionicons/icons';
import { ToastService } from '../../../core/services/ui/toast.service';
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
  imports: [IonIcon, TranslocoPipe],
  template: `
    <div class="section-item">
      <div class="section-item__text">
        <h2 class="section-item__title">{{ 'screens.afterTripReport.title' | transloco }}</h2>
        <p class="section-item__subtitle">
          @if (isSent()) {
            {{ 'screens.afterTripReport.sent' | transloco }}
          } @else {
            {{ 'screens.afterTripReport.hint' | transloco }}
          }
        </p>
      </div>
      @if (!isSent()) {
        <button
          type="button"
          class="icon-btn icon-btn--labeled"
          [attr.aria-label]="'screens.afterTripReport.reportAria' | transloco"
          (click)="handleReport()"
        >
          <ion-icon [icon]="reportIcon" aria-hidden="true" />
          <span class="icon-btn__label" aria-hidden="true">{{
            'screens.afterTripReport.report' | transloco
          }}</span>
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
      // Tan alta como el formulario (hoja abajo en el móvil, ventana en escritorio)
      cssClass: 'info-dialog',
    });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      this.isSent.set(true);
      void this.toast.showSuccess(
        translate('screens.afterTripReport.reporteEnviadoRevisaraAdministrador'),
      );
    }
  }
}
