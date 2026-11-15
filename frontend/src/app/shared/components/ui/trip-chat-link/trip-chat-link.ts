import { Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { chatbubblesOutline } from 'ionicons/icons';
import { EMPTY } from 'rxjs';

// «Chat con el conductor» o «Escribir a Pía»: abre la conversación directa en
// Mensajes (el conductor indica el pasajero; el pasajero, nada). En la tarjeta
// del conductor, el detalle de la solicitud aceptada del pasajero y la
// pantalla del viaje en curso
@Component({
  selector: 'app-trip-chat-link',
  imports: [IonButton, IonIcon, RouterLink],
  template: `
    <ion-button class="trip-chat-link" [fill]="fill()" [expand]="expand()" [routerLink]="route()">
      <ion-icon slot="start" [icon]="icon" aria-hidden="true" />
      {{ label() }}
    </ion-button>
  `,
})
export class TripChatLink {
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  private readonly translation = toSignal(this.transloco?.selectTranslation() ?? EMPTY);

  readonly tripId = input.required<string>();
  // El pasajero de la conversación (solo el conductor lo indica)
  readonly passengerId = input<string | null>(null);
  // A todo el ancho (detalle de la solicitud) o a su medida (tarjeta)
  readonly expand = input<'block' | undefined>(undefined);
  // Con borde (por defecto) o azul relleno (la acción principal del pasajero)
  readonly fill = input<'outline' | 'solid'>('outline');

  protected readonly icon = chatbubblesOutline;
  // Otro texto que el de por defecto (p. ej. «Chat con el conductor»)
  readonly text = input<string | null>(null);

  protected readonly route = computed(() => {
    const passengerId = this.passengerId();
    return passengerId
      ? ['/tabs/messages', this.tripId(), passengerId]
      : ['/tabs/messages', this.tripId()];
  });

  protected readonly label = computed(() => {
    return (
      this.text() ??
      (this.translation() ? this.transloco?.translate('common.tripChatLink') : null) ??
      'Chat del viaje'
    );
  });
}
