import { Component, inject, input } from '@angular/core';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { paperPlaneOutline } from 'ionicons/icons';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { RevealOnTouch } from '../../../shared/directives/reveal-on-touch.directive';
import { TripLiveShare } from '../trip-live-share/trip-live-share';

// «Viaje seguro» en el viaje en curso, como las demás tarjetas de la hoja.
// Pasajero: el enlace en directo. Conductor: compartir el viaje con alguien de
// confianza (el menú del sistema o WhatsApp). El 112 va en la esquina de las
// pastillas de cada pantalla
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

  protected readonly shareIcon = paperPlaneOutline;

  async handleShare(): Promise<void> {
    await this.tripShare.share({ title: 'Mi viaje en Carpooling UAL', text: this.shareText() });
  }
}
