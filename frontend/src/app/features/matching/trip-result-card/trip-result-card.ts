import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { locationOutline } from 'ionicons/icons';
import { TripResult } from '../../../core/models/trip-result.model';
import { TripDriver } from '../trip-driver/trip-driver';

// Un viaje de los resultados (TripRow de la guía): horas de salida y llegada
// con las plazas libres («Última plaza» en naranja si solo queda una), el
// trayecto, quien conduce y el desvío para recoger al pasajero. «Ver viaje
// la dirección del pasajero. Toda la tarjeta lleva al detalle del viaje
@Component({
  selector: 'app-trip-result-card',
  imports: [RouterLink, IonCard, IonCardContent, IonIcon, TripDriver],
  templateUrl: './trip-result-card.html',
  styleUrl: './trip-result-card.scss',
})
export class TripResultCard {
  readonly trip = input.required<TripResult>();

  readonly isLastSeat = computed(() => this.trip().freeSeats === 1);
  readonly passengerAction = computed(() =>
    this.trip().direction === 'to-campus' ? 'recogerte' : 'dejarte',
  );

  protected readonly pickupIcon = locationOutline;
}
