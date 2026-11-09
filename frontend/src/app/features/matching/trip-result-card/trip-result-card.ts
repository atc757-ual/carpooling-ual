import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { locationOutline } from 'ionicons/icons';
import { TripResult } from '../../../core/models/trip-result.model';
import { getFirstName, TripDriver } from '../trip-driver/trip-driver';

// Un viaje de los resultados (TripRow de la guía): horas de salida y llegada
// con las plazas libres («Última plaza» en naranja si solo queda una), el
// trayecto, quien conduce y dónde recoge al pasajero. Toda la tarjeta lleva al
// detalle del viaje
@Component({
  selector: 'app-trip-result-card',
  imports: [RouterLink, IonCard, IonCardContent, IonIcon, TripDriver],
  templateUrl: './trip-result-card.html',
  styleUrl: './trip-result-card.scss',
})
export class TripResultCard {
  readonly trip = input.required<TripResult>();

  // El pasajero ya tiene una solicitud viva en este viaje
  readonly isRequested = input(false);

  readonly isLastSeat = computed(() => this.trip().freeSeats === 1);
  // «Recogida en Calle Mayor» o, al volver del campus, «Bajada en Calle Mayor»
  readonly passengerStopLabel = computed(() => {
    const { direction, passengerStop } = this.trip();
    return `${direction === 'to-campus' ? 'Recogida' : 'Bajada'} en ${passengerStop}`;
  });
  // Lo que lee el lector de pantalla del enlace (cubre toda la tarjeta)
  readonly linkLabel = computed(() => {
    const { driver, departureTime, arrivalTime, origin, destination } = this.trip();
    const requested = this.isRequested() ? ', ya solicitado' : '';
    return `Ver viaje de ${getFirstName(driver.name)}: ${departureTime} → ${arrivalTime}, ${origin} → ${destination}${requested}`;
  });

  protected readonly pickupIcon = locationOutline;
}
