import { Component, computed, input } from '@angular/core';
import { MATCH_FIT_LABELS, MatchFit } from '../match-fit';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { timeOutline, chevronForward } from 'ionicons/icons';
import { TripResult } from '../../../core/models/trip-result.model';
import { getFirstName } from '../trip-driver/trip-driver';
import { formatWalkingDistance } from '../../../shared/utils/distance.util';

// Un viaje de los resultados (SearchTripCard de la guía): horas de salida y
// llegada con las plazas libres («Última plaza» en píldora ámbar si solo queda
// una), el trayecto, quien conduce y el desvío con la hora de salida. Toda la
// tarjeta lleva al detalle del viaje
@Component({
  selector: 'app-trip-result-card',
  imports: [RouterLink, IonIcon],
  templateUrl: './trip-result-card.html',
  styleUrl: './trip-result-card.scss',
})
export class TripResultCard {
  readonly trip = input.required<TripResult>();

  // El pasajero ya tiene una solicitud viva en este viaje
  readonly isRequested = input(false);
  // El más compatible según el matching
  readonly isBestMatch = input(false);
  // Cómo encaja con la búsqueda: el color del borde de abajo
  readonly fit = input<MatchFit>('fair');
  protected readonly chevronIcon = chevronForward;
  protected readonly fitLabel = computed(() => MATCH_FIT_LABELS[this.fit()]);

  readonly isLastSeat = computed(() => this.trip().freeSeats === 1);

  // Sin repetir la calle de la ruta: dónde y cuándo le recoge. En paradas, la
  // suya (andando); si no, el desvío y la hora de recogida (o de salida)
  readonly pickupMetaLabel = computed(() => {
    const { pickupDetourMinutes, departureTime, pickupTime, pickupStop } = this.trip();
    if (pickupStop) {
      const at = pickupTime ? ` · a las ${pickupTime}` : '';
      return `En la parada ${pickupStop.name} (a ${formatWalkingDistance(pickupStop.walkingDistanceM)})${at}`;
    }
    const detour = pickupDetourMinutes <= 0 ? 'En su ruta' : `Desvío de ${pickupDetourMinutes} min`;
    return pickupTime
      ? `${detour} · te recoge a las ${pickupTime}`
      : `${detour} · sale a las ${departureTime}`;
  });

  // Lo que lee el lector de pantalla del enlace (cubre toda la tarjeta)
  readonly linkLabel = computed(() => {
    const { driver, departureTime, arrivalTime, origin, destination } = this.trip();
    const requested = this.isRequested() ? ', ya solicitado' : '';
    return `Ver viaje de ${getFirstName(driver.name)}: ${departureTime} → ${arrivalTime}, ${origin} → ${destination}${requested}`;
  });

  protected readonly timeIcon = timeOutline;
}
