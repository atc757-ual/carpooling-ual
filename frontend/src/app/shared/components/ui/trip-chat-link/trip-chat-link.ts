import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular';
import { chatbubblesOutline } from 'ionicons/icons';

// «Chat del viaje»: abre la conversación del viaje en Mensajes. En la tarjeta
// del conductor, el detalle de la solicitud aceptada del pasajero y la
// pantalla del viaje en curso
@Component({
  selector: 'app-trip-chat-link',
  imports: [IonButton, IonIcon, RouterLink],
  template: `
    <ion-button
      class="trip-chat-link"
      fill="outline"
      [expand]="expand()"
      [routerLink]="['/tabs/messages', tripId()]"
    >
      <ion-icon slot="start" [icon]="icon" aria-hidden="true" />
      Chat del viaje
    </ion-button>
  `,
})
export class TripChatLink {
  readonly tripId = input.required<string>();
  // A todo el ancho (detalle de la solicitud) o a su medida (tarjeta)
  readonly expand = input<'block' | undefined>(undefined);

  protected readonly icon = chatbubblesOutline;
}
