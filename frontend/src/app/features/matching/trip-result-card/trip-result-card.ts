import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, input } from '@angular/core';
import { TravelPreferencesStore } from '../../../core/services/catalogs/travel-preferences.store';
import { MATCH_FIT_LABELS, MatchFit } from '../match-fit';
import { RouterLink } from '@angular/router';
import { IonIcon, IonItem, IonRouterLink } from '@ionic/angular';
import { timeOutline } from 'ionicons/icons';
import { TripResult } from '../../../core/models/trip-result.model';
import { getFirstName } from '../trip-driver/trip-driver';
import { formatWalkingDistance } from '../../../shared/utils/distance.util';
import { formatSeats } from '../../../shared/utils/seats.util';
import { localizedComputed } from '../../../core/i18n/localized-computed';

// Un viaje de los resultados (SearchTripCard de la guía): horas de salida y
// llegada con las plazas libres («Última plaza» en píldora ámbar si solo queda
// una), el trayecto, quien conduce y el desvío con la hora de salida. Toda la
// tarjeta es un ion-item que lleva al detalle del viaje
@Component({
  selector: 'app-trip-result-card',
  imports: [RouterLink, IonRouterLink, IonItem, IonIcon, TranslocoPipe],
  templateUrl: './trip-result-card.html',
  styleUrl: './trip-result-card.scss',
})
export class TripResultCard {
  private readonly travelPreferences = inject(TravelPreferencesStore);

  readonly trip = input.required<TripResult>();

  // Las preferencias del conductor: en móvil las 3 primeras y +N; en escritorio todas
  readonly preferences = computed(() =>
    this.travelPreferences.format(this.trip().driver.preferences),
  );

  // El pasajero ya tiene una solicitud viva en este viaje
  readonly isRequested = input(false);
  // El más compatible según el matching
  readonly isBestMatch = input(false);
  // Las preferencias del conductor encajan con las del perfil del pasajero
  readonly isPreferenceMatch = input(false);
  // Cómo encaja con la búsqueda: el color del borde de abajo
  readonly fit = input<MatchFit>('fair');
  protected readonly fitLabel = computed(() => MATCH_FIT_LABELS[this.fit()]);

  readonly isLastSeat = computed(() => this.trip().freeSeats === 1);
  // «3 plazas»
  readonly seatsLabel = localizedComputed(() => formatSeats(this.trip().freeSeats));

  // Sin repetir la calle de la ruta: dónde y cuándo le recoge. En paradas, la
  // suya (andando); si no, el desvío y la hora de recogida (o de salida)
  readonly pickupMetaLabel = localizedComputed(() => {
    const { pickupDetourMinutes, departureTime, pickupTime, pickupStop } = this.trip();
    if (pickupStop) {
      const walk = formatWalkingDistance(pickupStop.walkingDistanceM);
      return pickupTime
        ? translate('screens.tripResultCard.stopAt', {
            stop: pickupStop.name,
            walk,
            time: pickupTime,
          })
        : translate('screens.tripResultCard.stop', { stop: pickupStop.name, walk });
    }
    const detour =
      pickupDetourMinutes <= 0
        ? translate('screens.tripResultCard.ruta')
        : translate('screens.tripResultCard.desvioMin', { pickupDetourMinutes });
    return pickupTime
      ? translate('screens.tripResultCard.pickupAt', { detour, time: pickupTime })
      : translate('screens.tripResultCard.departsAt', { detour, time: departureTime });
  });

  // Lo que lee el lector de pantalla del enlace (cubre toda la tarjeta)
  readonly linkLabel = localizedComputed(() => {
    const { driver, departureTime, arrivalTime, origin, destination } = this.trip();
    const requested = this.isRequested()
      ? translate('screens.tripResultCard.alreadyRequested')
      : '';
    return translate('screens.tripResultCard.verViaje', {
      name: getFirstName(driver.name),
      departureTime,
      arrivalTime,
      origin,
      destination,
      requested,
    });
  });

  protected readonly timeIcon = timeOutline;
}
