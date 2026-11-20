import { Component, inject } from '@angular/core';
import { IonIcon, IonLabel, IonSegment, IonSegmentButton } from '@ionic/angular';
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

// Elegir qué preguntas se ven en «Ayuda y soporte»: un ion-segment con dos
// pestañas (pasajero y conductor). No cambia el modo de la app
@Component({
  selector: 'app-help-audience-picker',
  imports: [IonIcon, IonLabel, IonSegment, IonSegmentButton, TranslocoPipe],
  templateUrl: './help-audience-picker.html',
  styleUrl: './help-audience-picker.scss',
})
export class HelpAudiencePicker {
  private readonly helpAudience = inject(HelpAudienceService);

  readonly audience = this.helpAudience.audience;
  protected readonly options = OPTIONS;

  // ion-segment da el valor como string | number | undefined
  handleChange(value: unknown): void {
    if (value === 'passenger' || value === 'driver') {
      this.helpAudience.select(value);
    }
  }
}
