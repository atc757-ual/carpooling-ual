import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonIcon, ModalController } from '@ionic/angular';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { createOutline, repeatOutline, trashOutline } from 'ionicons/icons';
import { appLocale } from '../../../../core/i18n/app-locale';
import { TripDirection } from '../../../../core/models/trip-search.model';
import { UsualTrip } from '../../../../core/models/usual-trip.model';
import { CONFIRM_ICONS, ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { TripSearchStateService } from '../../trip-search-state.service';
import { usualTripFromSearch, usualTripSearch } from '../usual-trip';
import { UsualTripModal } from '../usual-trip-modal/usual-trip-modal';
import { UsualTripService } from '../usual-trip.service';
import { localizedComputed } from '../../../../core/i18n/localized-computed';

// «lunes, miércoles y viernes» (las horas van en la fila de la ida y la vuelta)
export function usualTripDays(trip: UsualTrip): string {
  return new Intl.ListFormat(appLocale(), { type: 'conjunction' }).format(
    trip.weekdays.map((day) => translate(`common.weekdays.long.${day}`)),
  );
}

// «Mi trayecto habitual» en Buscar: con el trayecto guardado, buscar la ida o
// la vuelta del próximo día que toca de un toque (y editarlo); sin él, tras
// una búsqueda, guardarla como trayecto habitual. Solo en este dispositivo
@Component({
  selector: 'app-usual-trip-card',
  imports: [IonButton, IonCard, IonCardContent, IonIcon, TranslocoPipe],
  templateUrl: './usual-trip-card.html',
  styleUrl: './usual-trip-card.scss',
})
export class UsualTripCard {
  private readonly usualTrips = inject(UsualTripService);
  private readonly searchState = inject(TripSearchStateService);
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  protected readonly usualIcon = repeatOutline;
  protected readonly editIcon = createOutline;
  protected readonly removeIcon = trashOutline;

  readonly trip = this.usualTrips.trip;
  readonly isLoaded = this.usualTrips.isLoaded;
  // Sin trayecto guardado: la búsqueda que se puede guardar
  readonly search = this.searchState.search;
  readonly days = localizedComputed(() => {
    const trip = this.trip();
    return trip ? usualTripDays(trip) : '';
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

  // Borrarlo, tras confirmarlo en la ventana de la guía
  async handleRemove(): Promise<void> {
    const isConfirmed = await this.confirm.ask({
      header: translate('usualTrip.removeTitle'),
      message: translate('usualTrip.removeText'),
      confirmText: translate('usualTrip.removeAction'),
      icon: CONFIRM_ICONS.remove,
    });
    if (!isConfirmed) {
      return;
    }
    await this.usualTrips.remove();
    void this.toast.showSuccess(translate('usualTrip.removed'));
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
