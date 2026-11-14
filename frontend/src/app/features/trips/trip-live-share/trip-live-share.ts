import { Component, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { closeCircleOutline, radioOutline, shareSocialOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { TripLiveShareService } from '../../../core/services/trips/trip-live-share.service';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

const SHARE_TITLE = 'Mi viaje en Carpooling UAL';
const SHARE_TEXT = 'Sigue mi viaje en directo: dónde está el coche y cuándo llego.';

// Compartir el viaje en directo (pasajero con la plaza aceptada): genera un
// enlace secreto que abre, sin cuenta, alguien de confianza, y lo envía con el
// menú del sistema o WhatsApp. Mientras se comparte, se puede reenviar o dejar
// de compartir (el enlace deja de funcionar al momento)
@Component({
  selector: 'app-trip-live-share',
  imports: [IonButton, IonIcon],
  templateUrl: './trip-live-share.html',
  styleUrl: './trip-live-share.scss',
})
export class TripLiveShare {
  private readonly liveShare = inject(TripLiveShareService);
  private readonly tripShare = inject(TripShareService);
  private readonly toast = inject(ToastService);

  readonly tripId = input.required<string>();

  // El enlace que este dispositivo está compartiendo (el servidor no lo guarda)
  private readonly storedLink = resource({
    params: () => this.tripId(),
    loader: ({ params }) => this.liveShare.getActiveLink(params),
  });
  readonly activeLink = linkedSignal<string | null>(() =>
    this.storedLink.hasValue() ? this.storedLink.value() : null,
  );
  readonly isBusy = signal(false);

  protected readonly shareIcon = shareSocialOutline;
  protected readonly liveIcon = radioOutline;
  protected readonly stopIcon = closeCircleOutline;

  async handleStart(): Promise<void> {
    await this.run(async () => {
      const url = await this.liveShare.start(this.tripId());
      this.activeLink.set(url);
      await this.send(url);
    });
  }

  async handleResend(): Promise<void> {
    const url = this.activeLink();
    if (url) {
      await this.send(url);
    }
  }

  async handleStop(): Promise<void> {
    await this.run(async () => {
      await this.liveShare.stop(this.tripId());
      this.activeLink.set(null);
      await this.toast.showSuccess('Has dejado de compartir el viaje: el enlace ya no funciona.');
    });
  }

  private async send(url: string): Promise<void> {
    await this.tripShare.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
  }

  // Un solo paso a la vez; los errores de la API, en un aviso
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    try {
      await action();
    } catch (error) {
      await this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isBusy.set(false);
    }
  }
}
