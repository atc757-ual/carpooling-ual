import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonRouterLink } from '@ionic/angular';
import { TripResult } from '../../../core/models/trip-result.model';

const RATING_FORMAT = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// «Lucía Cortés» → «LC» (las iniciales hacen de foto)
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// Un viaje de los resultados (TripRow de la guía): horas de salida y llegada
// con las plazas libres («Última plaza» en naranja si solo queda una), el
// trayecto, el conductor (iniciales, viajes, correo verificado y valoración)
// y el desvío para recoger al pasajero. «Ver viaje de …» lleva a su detalle
@Component({
  selector: 'app-trip-result-card',
  imports: [RouterLink, IonButton, IonCard, IonCardContent, IonRouterLink],
  templateUrl: './trip-result-card.html',
  styleUrl: './trip-result-card.scss',
})
export class TripResultCard {
  readonly trip = input.required<TripResult>();

  readonly initials = computed(() => getInitials(this.trip().driver.name));
  readonly driverFirstName = computed(() => this.trip().driver.name.split(' ')[0]);
  readonly rating = computed(() => RATING_FORMAT.format(this.trip().driver.rating));
  readonly isLastSeat = computed(() => this.trip().freeSeats === 1);

  // «42 viajes · Correo UAL verificado»
  readonly driverDetails = computed(() => {
    const { tripCount, isEmailVerified } = this.trip().driver;
    const trips = tripCount === 1 ? '1 viaje' : `${tripCount} viajes`;
    return isEmailVerified ? `${trips} · Correo UAL verificado` : trips;
  });
}
