import { Component, inject, input } from '@angular/core';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { paperPlaneOutline } from 'ionicons/icons';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { RevealOnTouch } from '../../../shared/directives/reveal-on-touch.directive';
import { TripLiveShare } from '../trip-live-share/trip-live-share';

// Seguridad durante el viaje en curso. Conductor (en línea): compartir el
// viaje con alguien de confianza (el menú del sistema o WhatsApp) y llamar al
// 112, como iconos junto a «Terminar viaje». Pasajero (tarjeta «Viaje
// seguro»): el enlace en directo. La llamada abre la app de teléfono con el
// número puesto: el usuario confirma, así que un toque sin querer no llama
@Component({
  selector: 'app-live-trip-safety',
  imports: [IonCard, IonCardContent, IonIcon, RevealOnTouch, TripLiveShare],
  templateUrl: './live-trip-safety.html',
  styleUrl: './live-trip-safety.scss',
})
export class LiveTripSafety {
  private readonly tripShare = inject(TripShareService);

  // Conductor: el mensaje para la persona de confianza (el trayecto y con quién)
  readonly shareText = input('');
  // Pasajero: el enlace en directo de este viaje
  readonly liveShareTripId = input<string | null>(null);
  // Conductor: solo los dos iconos, sin tarjeta
  readonly isInline = input(false);

  protected readonly shareIcon = paperPlaneOutline;

  async handleShare(): Promise<void> {
    await this.tripShare.share({ title: 'Mi viaje en Carpooling UAL', text: this.shareText() });
  }
}
