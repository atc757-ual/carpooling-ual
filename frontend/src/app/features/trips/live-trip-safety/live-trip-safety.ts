import { Component, inject, input, output } from '@angular/core';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { paperPlaneOutline } from 'ionicons/icons';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { TripLiveShare } from '../trip-live-share/trip-live-share';

// Seguridad durante el viaje en curso (conductor y pasajero): compartir el
// viaje con alguien de confianza (el menú del sistema o WhatsApp) y llamar al
// 112. La llamada abre la app de teléfono con el número puesto: el usuario
// confirma, así que un toque sin querer no llama
@Component({
  selector: 'app-live-trip-safety',
  imports: [IonCard, IonCardContent, IonIcon, TripLiveShare],
  templateUrl: './live-trip-safety.html',
  styleUrl: './live-trip-safety.scss',
})
export class LiveTripSafety {
  private readonly tripShare = inject(TripShareService);

  // El mensaje para la persona de confianza: el trayecto y con quién
  readonly shareText = input.required<string>();
  // Pasajero: en vez del texto, el enlace en directo de este viaje
  readonly liveShareTripId = input<string | null>(null);
  // Pasajero: quiere dejar de compartir; la pantalla lo confirma en la hoja
  readonly stopShareRequest = output<() => Promise<void>>();

  protected readonly shareIcon = paperPlaneOutline;

  async handleShare(): Promise<void> {
    await this.tripShare.share({ title: 'Mi viaje en Carpooling UAL', text: this.shareText() });
  }
}
