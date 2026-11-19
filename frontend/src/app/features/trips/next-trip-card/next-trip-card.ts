import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { carOutline, chatbubblesOutline, personOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { formatTime } from '../../matching/trip-results';
import { formatRoute, occupiedSeats } from '../my-trips/my-trips-summary';
import { LiveTripBanner } from '../my-trips/live-trip-banner/live-trip-banner';
import { RevealOnTouch } from '../../../shared/directives/reveal-on-touch.directive';
import { isOpenRequest, NextTrip, nextTripLink, nextTripStatus, pickNextTrip } from './next-trip';

// «Próximo viaje», arriba de Buscar y de Publicar: el viaje más cercano del
// usuario en cualquiera de sus papeles (el que está en curso, con la misma
// tarjeta que arriba de Tus viajes), con la hora, el trayecto, el estado, el papel y el acceso. El
// pasajero con plaza tiene además el chat con el conductor. Sin viaje no se
// ve. Ionic guarda las pantallas: quien la usa llama a reload() al volver a
// la pestaña (ionViewWillEnter)
@Component({
  selector: 'app-next-trip-card',
  imports: [RouterLink, IonIcon, LiveTripBanner, RevealOnTouch, TranslocoPipe],
  templateUrl: './next-trip-card.html',
  styleUrl: './next-trip-card.scss',
})
export class NextTripCard {
  private readonly auth = inject(AuthService);
  private readonly driver = inject(DriverService);
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);

  private readonly profiles = computed(() => {
    this.auth.currentUser();
    return {
      canDrive: this.auth.hasProfile('driver'),
      canRide: this.auth.hasProfile('passenger'),
    };
  });

  private readonly data = resource({
    params: () => this.profiles(),
    loader: async ({ params }): Promise<NextTrip | null> => {
      const [driven, ridden] = await Promise.all([
        params.canDrive ? this.loadDriven() : Promise.resolve([]),
        params.canRide ? this.loadRidden() : Promise.resolve([]),
      ]);
      return pickNextTrip([...driven, ...ridden]);
    },
  });

  readonly next = computed(() => (this.data.hasValue() ? this.data.value() : null));
  readonly isLive = computed(() => this.next()?.trip.status === 'in_progress');
  readonly link = computed(() => {
    const next = this.next();
    return next ? nextTripLink(next) : '';
  });
  readonly status = computed(() => {
    const next = this.next();
    return next ? nextTripStatus(next) : null;
  });
  readonly when = computed(() => {
    const next = this.next();
    if (!next) {
      return '';
    }
    const day = formatDateLabel(new Date(next.trip.departureAt).toLocaleDateString('sv-SE'));
    return `${day} · ${formatTime(next.trip.departureAt)}`;
  });
  readonly route = computed(() => {
    const next = this.next();
    return next ? formatRoute(next.trip) : '';
  });
  // El chat con el conductor: solo el pasajero con la plaza aceptada
  readonly chatLink = computed(() => {
    const next = this.next();
    return next?.role === 'passenger' && next.request.status === 'accepted'
      ? `/tabs/messages/${next.trip.id}`
      : null;
  });
  // En curso: cuántos van (conductor) o quién conduce (pasajero), como en la
  // tarjeta de Tus viajes
  readonly liveDetail = computed(() => {
    const next = this.next();
    if (!next) {
      return '';
    }
    return next.role === 'driver'
      ? translate('screens.nextTripCard.plazasOcupadas', {
          value1: occupiedSeats(next.trip),
          offeredSeats: next.trip.offeredSeats,
        })
      : `Conduce ${next.trip.driver.name}`;
  });
  readonly actionLabel = computed(() => {
    return this.next()?.role === 'driver'
      ? translate('screens.nextTripCard.verViaje')
      : translate('screens.nextTripCard.verPlaza');
  });

  reload(): void {
    this.data.reload();
  }

  private async loadDriven(): Promise<NextTrip[]> {
    const trips = await this.driver.listMyTrips();
    return trips.map((trip) => ({ role: 'driver' as const, trip }));
  }

  // Solo se pide el viaje de las plazas pendientes o aceptadas
  private async loadRidden(): Promise<NextTrip[]> {
    const requests = (await this.seatRequests.listMine()).filter(isOpenRequest);
    return Promise.all(
      requests.map(async (request) => ({
        role: 'passenger' as const,
        request,
        trip: await this.trips.getTrip(request.trip.id),
      })),
    );
  }

  protected readonly driverIcon = carOutline;
  protected readonly passengerIcon = personOutline;
  protected readonly chatIcon = chatbubblesOutline;
}
