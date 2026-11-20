import { TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonItem, IonLabel } from '@ionic/angular';
import { carOutline, ellipseOutline, locationOutline } from 'ionicons/icons';
import { formatRoute, routeEnds, TripEnds } from '../my-trips-summary';

// El viaje en curso, destacado arriba de Tus viajes, del detalle del viaje y
// de Buscar y Publicar (en lugar de la tarjeta del próximo viaje): de dónde a
// dónde y un detalle (quién conduce o cuántos van). El aviso entero es un
// ion-item que lleva a su pantalla (la del conductor o la del pasajero)
@Component({
  selector: 'app-live-trip-banner',
  imports: [RouterLink, IonIcon, IonItem, IonLabel, TranslocoPipe],
  templateUrl: './live-trip-banner.html',
  styleUrl: './live-trip-banner.scss',
})
export class LiveTripBanner {
  readonly trip = input.required<TripEnds>();
  readonly detail = input('');
  readonly link = input.required<string>();

  // En escritorio, en una línea; en el móvil, el origen y el destino por separado
  readonly route = computed(() => formatRoute(this.trip()));
  readonly ends = computed(() => routeEnds(this.trip()));

  // El coche, como la pestaña «En curso»; el origen y el destino, como en el
  // título de la conversación
  protected readonly liveIcon = carOutline;
  protected readonly originIcon = ellipseOutline;
  protected readonly destinationIcon = locationOutline;
}
