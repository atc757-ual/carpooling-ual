import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { carOutline } from 'ionicons/icons';
import { RevealOnTouch } from '../../../../shared/directives/reveal-on-touch.directive';

// El viaje en curso, destacado arriba de Mis viajes: de dónde a dónde, un
// detalle (quién conduce o cuántos van) y el coche («Abrir viaje»), que lleva a su
// pantalla (la del conductor o la del pasajero, con el mapa en vivo). También
// arriba de Buscar y Publicar (en la tarjeta del próximo viaje)
@Component({
  selector: 'app-live-trip-banner',
  imports: [RouterLink, IonIcon, RevealOnTouch],
  templateUrl: './live-trip-banner.html',
  styleUrl: './live-trip-banner.scss',
})
export class LiveTripBanner {
  readonly route = input.required<string>();
  readonly detail = input('');
  readonly link = input.required<string>();

  // El coche, como la pestaña «En curso»
  protected readonly liveIcon = carOutline;
}
