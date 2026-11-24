import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonCard, IonCardContent, ModalController } from '@ionic/angular';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { appLocale } from '../../../../core/i18n/app-locale';
import { TripDirection } from '../../../../core/models/trip-search.model';
import { UsualTrip } from '../../../../core/models/usual-trip.model';
import { TripSearchStateService } from '../../trip-search-state.service';
import { usualTripFromSearch, usualTripSearch } from '../usual-trip';
import { UsualTripModal } from '../usual-trip-modal/usual-trip-modal';
import { UsualTripService } from '../usual-trip.service';

// «lunes, miércoles y viernes · llegar a las 08:00 y volver a las 14:00»
export function usualTripWhen(trip: UsualTrip): string {
  const days = new Intl.ListFormat(appLocale(), { type: 'conjunction' }).format(
    trip.weekdays.map((day) => translate(`common.weekdays.long.${day}`)),
  );
  return trip.returnTime === null
    ? translate('usualTrip.when', { days, time: trip.arrivalTime })
    : translate('usualTrip.whenWithReturn', {
        days,
        time: trip.arrivalTime,
        returnTime: trip.returnTime,
      });
}

// «Mi trayecto» en Buscar: con el trayecto guardado, buscar la ida o la vuelta
// del próximo día que toca de un toque (y editarlo); sin él, tras una
// búsqueda, guardarla como trayecto habitual. Solo en este dispositivo
@Component({
  selector: 'app-usual-trip-card',
  imports: [IonButton, IonCard, IonCardContent, TranslocoPipe],
  templateUrl: './usual-trip-card.html',
  styleUrl: './usual-trip-card.scss',
})
export class UsualTripCard {
  private readonly usualTrips = inject(UsualTripService);
  private readonly searchState = inject(TripSearchStateService);
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);

  readonly trip = this.usualTrips.trip;
  readonly isLoaded = this.usualTrips.isLoaded;
  // Sin trayecto guardado: la búsqueda que se puede guardar
  readonly search = this.searchState.search;
  readonly when = computed(() => {
    const trip = this.trip();
    return trip ? usualTripWhen(trip) : '';
  });

  async handleSearch(direction: TripDirection): Promise<void> {
    const trip = this.trip();
    if (!trip) {
      return;
    }
    this.searchState.set(usualTripSearch(trip, direction, new Date()));
    await this.router.navigate(['/tabs/search/results']);
  }

  async handleSave(): Promise<void> {
    const search = this.search();
    if (search) {
      await this.openModal(usualTripFromSearch(search), true);
    }
  }

  async handleEdit(): Promise<void> {
    const trip = this.trip();
    if (trip) {
      await this.openModal(trip, false);
    }
  }

  private async openModal(trip: UsualTrip, isNew: boolean): Promise<void> {
    const modal = await this.modalController.create({
      component: UsualTripModal,
      cssClass: 'info-dialog',
      componentProps: { trip, isNew },
    });
    await modal.present();
  }
}
