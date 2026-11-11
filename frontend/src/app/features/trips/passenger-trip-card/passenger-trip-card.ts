import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent, IonIcon } from '@ionic/angular';
import { personOutline } from 'ionicons/icons';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { formatTime } from '../../matching/trip-results';
import { formatSeats } from '../../../shared/utils/seats.util';
import { formatRoute } from '../my-trips/my-trips-summary';
import { PassengerTrip } from '../my-trips/trip-entries';
import { passengerRequestLabel, TripsTab } from '../my-trips/trip-tabs';

// Un viaje del pasajero en Tus viajes: su solicitud con su viaje. Toda la
// tarjeta lleva a su detalle (donde se cancela) y dice el siguiente paso; en
// No realizados, el estado es el motivo. Arriba, «Viajas» (su papel)
@Component({
  selector: 'app-passenger-trip-card',
  imports: [RouterLink, IonCard, IonCardContent, IonIcon],
  templateUrl: './passenger-trip-card.html',
  styleUrl: './passenger-trip-card.scss',
})
export class PassengerTripCard {
  readonly item = input.required<PassengerTrip>();
  readonly tab = input<TripsTab>('upcoming');

  readonly time = computed(() => formatTime(this.item().trip.departureAt));
  readonly route = computed(() => formatRoute(this.item().trip));
  readonly statusLabel = computed(() =>
    passengerRequestLabel(this.item().request, this.item().trip),
  );
  readonly isPending = computed(
    () => this.tab() === 'upcoming' && this.item().request.status === 'pending',
  );
  readonly isAccepted = computed(
    () => this.tab() !== 'cancelled' && this.item().request.status === 'accepted',
  );

  // Lo que lee el lector de pantalla del enlace (cubre toda la tarjeta)
  readonly linkLabel = computed(() => {
    const day = formatDateLabel(new Date(this.item().trip.departureAt).toLocaleDateString('sv-SE'));
    return `Ver solicitud, viajas: ${day}, ${this.time()}, ${this.route()}, ${this.statusLabel()}`;
  });

  // Qué falta: «Esperando respuesta de Lucía», «Confirmada: te recoge a las
  // 08:10». Sin siguiente paso en las demás pestañas
  readonly nextStep = computed(() => {
    const { request, trip } = this.item();
    if (this.tab() !== 'upcoming') {
      return null;
    }
    const driverName = getFirstName(trip.driver.name);
    if (request.status === 'pending') {
      return `Esperando respuesta de ${driverName}`;
    }
    // Sin hora de recogida por ahora: la estimada no suma las otras recogidas
    return `Confirmada: viajas con ${driverName}`;
  });

  // «Conduce Lucía Cortés · 2 plazas · Matrícula 1234BCD» (la matrícula, al confirmarla)
  readonly details = computed(() => {
    const { request, trip } = this.item();
    const parts = [`Conduce ${trip.driver.name}`, formatSeats(request.seats)];
    if (request.vehiclePlate) {
      parts.push(`Matrícula ${request.vehiclePlate}`);
    }
    return parts.join(' · ');
  });

  protected readonly roleIcon = personOutline;
}
