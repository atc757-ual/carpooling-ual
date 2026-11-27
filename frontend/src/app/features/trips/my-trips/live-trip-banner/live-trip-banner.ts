import { TranslocoPipe } from '@jsverse/transloco';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonItem, IonLabel } from '@ionic/angular';
import { carOutline, chevronForward, locationOutline, personOutline } from 'ionicons/icons';
import { routeEnds, TripEnds } from '../my-trips-summary';
import { localizedComputed } from '../../../../core/i18n/localized-computed';

// El viaje en curso, destacado arriba de Tus viajes, del detalle del viaje y
// de Buscar y Publicar (en lugar de la tarjeta del próximo viaje): de dónde a
// dónde y un detalle (quién conduce o cuántos van). El aviso entero es un
// ion-item que lleva a su pantalla (la del conductor o la del pasajero)
@Component({
  selector: 'app-live-trip-banner',
  imports: [RouterLink, IonIcon, IonItem, IonLabel, TranslocoPipe],
  templateUrl: './live-trip-banner.html',
  styleUrl: './live-trip-banner.scss',
  // El marco común de las tarjetas de estado (la etiqueta sobre el borde)
  host: { class: 'status-card-frame' },
})
export class LiveTripBanner {
  readonly trip = input.required<TripEnds>();
  readonly detail = input('');
  readonly link = input.required<string>();
  // Si conduce o viaja (la etiqueta de papel, como en «Próximo viaje»)
  readonly role = input<'driver' | 'passenger' | null>(null);

  // El origen y el destino por separado, uno debajo del otro
  readonly ends = localizedComputed(() => routeEnds(this.trip()));

  // La flecha de abrir; el destino, como en el
  // título de la conversación
  protected readonly chevronIcon = chevronForward;
  protected readonly destinationIcon = locationOutline;
  protected readonly driverIcon = carOutline;
  protected readonly passengerIcon = personOutline;
}
