import { Component, inject, input } from '@angular/core';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { paperPlaneOutline } from 'ionicons/icons';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { RevealOnTouch } from '../../../shared/directives/reveal-on-touch.directive';

// «Viaje seguro» en el viaje en curso, como las demás tarjetas de la hoja.
// Conductor y pasajero: compartir el viaje con alguien de confianza (el menú
// del sistema o WhatsApp), con el mismo texto y botón. El 112 va en la esquina de las
// pastillas de cada pantalla
@Component({
  selector: 'app-live-trip-safety',
  imports: [IonCard, IonCardContent, IonIcon, RevealOnTouch, TranslocoPipe],
  templateUrl: './live-trip-safety.html',
  styleUrl: './live-trip-safety.scss',
})
export class LiveTripSafety {
  private readonly tripShare = inject(TripShareService);
  private readonly transloco = inject(TranslocoService);

  // El mensaje para la persona de confianza (el trayecto y, del pasajero, con quién)
  readonly shareText = input.required<string>();

  protected readonly shareIcon = paperPlaneOutline;

  async handleShare(): Promise<void> {
    await this.tripShare.share({
      title: this.transloco.translate('share.liveTitle'),
      text: this.shareText(),
    });
  }
}
