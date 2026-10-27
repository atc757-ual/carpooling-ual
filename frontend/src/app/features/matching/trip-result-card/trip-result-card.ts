import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonRouterLink } from '@ionic/angular';
import { TripResult } from '../../../core/models/trip-result.model';
import { getFirstName, TripDriver } from '../trip-driver/trip-driver';

// Un viaje de los resultados (TripRow de la guía): horas de salida y llegada
// con las plazas libres («Última plaza» en naranja si solo queda una), el
// trayecto, quien conduce y el desvío para recoger al pasajero. «Ver viaje
// de …» lleva a su detalle
@Component({
  selector: 'app-trip-result-card',
  imports: [RouterLink, IonButton, IonCard, IonCardContent, IonRouterLink, TripDriver],
  templateUrl: './trip-result-card.html',
  styleUrl: './trip-result-card.scss',
})
export class TripResultCard {
  readonly trip = input.required<TripResult>();

  readonly driverFirstName = computed(() => getFirstName(this.trip().driver.name));
  readonly isLastSeat = computed(() => this.trip().freeSeats === 1);
}
