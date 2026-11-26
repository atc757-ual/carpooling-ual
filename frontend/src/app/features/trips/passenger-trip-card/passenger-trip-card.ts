import { translate } from '@jsverse/transloco';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonItem, IonLabel, IonRouterLink } from '@ionic/angular';
import { personOutline } from 'ionicons/icons';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { formatTime } from '../../matching/trip-results';
import { formatSeats } from '../../../shared/utils/seats.util';
import { formatRoute } from '../my-trips/my-trips-summary';
import { PassengerTrip } from '../my-trips/trip-entries';
import { passengerRequestLabel, TripsTab } from '../my-trips/trip-tabs';
import { tripWayOf } from '../trip-way';
import { localizedComputed } from '../../../core/i18n/localized-computed';

// Un viaje del pasajero en Tus viajes: su solicitud con su viaje. Toda la
// tarjeta lleva a su detalle (donde se cancela) y dice el siguiente paso; en
// No realizados, el estado es el motivo. Arriba, «Viajas» (su papel)
@Component({
  selector: 'app-passenger-trip-card',
  imports: [RouterLink, IonRouterLink, IonItem, IonLabel, IonIcon],
  templateUrl: './passenger-trip-card.html',
  styleUrl: './passenger-trip-card.scss',
})
export class PassengerTripCard {
  readonly item = input.required<PassengerTrip>();
  readonly tab = input<TripsTab>('upcoming');

  readonly time = computed(() => formatTime(this.item().trip.departureAt));
  readonly route = computed(() => formatRoute(this.item().trip));
  // «Ida al campus» o «Vuelta a casa», encima del trayecto
  readonly way = computed(() => tripWayOf(this.item().trip));
  readonly statusLabel = localizedComputed(() =>
    passengerRequestLabel(this.item().request, this.item().trip),
  );
  readonly isPending = computed(
    () => this.tab() === 'upcoming' && this.item().request.status === 'pending',
  );
  readonly isAccepted = computed(
    () =>
      this.tab() !== 'cancelled' &&
      (this.item().request.status === 'accepted' || this.item().request.status === 'completed'),
  );

  // Lo que lee el lector de pantalla del enlace (cubre toda la tarjeta)
  readonly linkLabel = localizedComputed(() => {
    const day = formatDateLabel(new Date(this.item().trip.departureAt).toLocaleDateString('sv-SE'));
    return translate('screens.passengerTripCard.linkLabel', {
      day,
      time: this.time(),
      route: this.route(),
      status: this.statusLabel(),
    });
  });

  // Su papel arriba: «Viajas» o, si terminó, «Viajaste»
  readonly roleLabel = localizedComputed(() =>
    translate(this.item().trip.status === 'finished' ? 'labels.role.rode' : 'labels.role.riding'),
  );

  // Qué falta: «Esperando respuesta de Lucía», «Confirmada: te recoge a las
  // 08:10». Sin siguiente paso en las demás pestañas
  readonly nextStep = localizedComputed(() => {
    const { request, trip } = this.item();
    if (this.tab() !== 'upcoming') {
      return null;
    }
    const driverName = getFirstName(trip.driver.name);
    if (request.status === 'pending') {
      return translate('screens.passengerTripCard.esperandoRespuesta', { driverName });
    }
    // Si ya está aceptada, la etiqueta superior y los detalles ya indican el estado
    // y con quién se viaja; se omite para evitar redundancias
    return null;
  });

  // «Conduce Lucía Cortés · 2 plazas · Matrícula 1234BCD» (la matrícula, al confirmarla)
  readonly details = localizedComputed(() => {
    const { request, trip } = this.item();
    // El código delante: «VJ-0042 · Conduce Mario · 1 plaza»
    const parts = [
      trip.code,
      translate('screens.passengerTripCard.drives', { name: trip.driver.name }),
      formatSeats(request.seats),
    ];
    if (request.vehiclePlate) {
      parts.push(translate('screens.passengerTripCard.plate', { plate: request.vehiclePlate }));
    }
    return parts.join(' · ');
  });

  protected readonly roleIcon = personOutline;
}
