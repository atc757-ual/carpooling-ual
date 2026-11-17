import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { carOutline, personOutline } from 'ionicons/icons';
import { HelpAudience } from '../../../../core/models/faq.model';
import { HelpAudienceService } from '../../../../core/services/help/help-audience.service';

interface AudienceOption {
  value: HelpAudience;
  icon: string;
}

const OPTIONS: readonly AudienceOption[] = [
  { value: 'passenger', icon: personOutline },
  { value: 'driver', icon: carOutline },
];

// Elegir qué preguntas se ven en «Ayuda y soporte»: dos pestañas en línea
// (pasajero y conductor) que funcionan como botones de opción. No cambia el
// modo de la app
@Component({
  selector: 'app-help-audience-picker',
  imports: [IonIcon, TranslocoPipe],
  templateUrl: './help-audience-picker.html',
  styleUrl: './help-audience-picker.scss',
})
export class HelpAudiencePicker {
  private readonly helpAudience = inject(HelpAudienceService);

  readonly audience = this.helpAudience.audience;
  protected readonly options = OPTIONS;

  handleSelect(audience: HelpAudience): void {
    this.helpAudience.select(audience);
  }
}
