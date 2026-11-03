import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonRouterLink } from '@ionic/angular';

// El viaje en curso, destacado arriba de Mis viajes: de dónde a dónde, un
// detalle (quién conduce o cuántos van) y «Abrir viaje», que lleva a su
// pantalla (la del conductor o la solicitud del pasajero, con el mapa en vivo)
@Component({
  selector: 'app-live-trip-banner',
  imports: [RouterLink, IonButton, IonRouterLink],
  templateUrl: './live-trip-banner.html',
  styleUrl: './live-trip-banner.scss',
})
export class LiveTripBanner {
  readonly route = input.required<string>();
  readonly detail = input('');
  readonly link = input.required<string>();
}
