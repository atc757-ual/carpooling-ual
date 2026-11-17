import { inject, Injectable, linkedSignal } from '@angular/core';
import { HelpAudience } from '../../models/faq.model';
import { ActiveModeService } from '../users/active-mode.service';

// Qué preguntas mira el usuario en «Ayuda y soporte» (las de pasajero o las
// de conductor). La comparten el inicio y los temas, para que la elección se
// mantenga al pasar de una pantalla a otra. Empieza en el modo de la app
// (pasajero si no tiene) y no lo cambia
@Injectable({ providedIn: 'root' })
export class HelpAudienceService {
  private readonly activeMode = inject(ActiveModeService);

  readonly audience = linkedSignal<HelpAudience>(() => this.activeMode.mode() ?? 'passenger');

  select(audience: HelpAudience): void {
    this.audience.set(audience);
  }
}
