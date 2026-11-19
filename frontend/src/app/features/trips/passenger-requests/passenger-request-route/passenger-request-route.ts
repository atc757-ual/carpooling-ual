import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { callOutline, carOutline, chatbubblesOutline, thumbsDown, thumbsUp } from 'ionicons/icons';
import { ChatContact } from '../../../../core/models/chat.model';
import { Trip } from '../../../../core/models/driver.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { TripDriver } from '../../../../core/models/trip-result.model';
import { TravelPreferencesStore } from '../../../../core/services/catalogs/travel-preferences.store';
import { VehicleColorsStore } from '../../../../core/services/catalogs/vehicle-colors.store';
import { TripCallService } from '../../../../core/services/trips/trip-call.service';
import { TripsService } from '../../../../core/services/trips/trips.service';
import {
  RouteStop,
  RouteTimeline,
} from '../../../../shared/components/ui/route-timeline/route-timeline';
import {
  RoutePoint,
  TripRouteMap,
} from '../../../../shared/components/ui/trip-route-map/trip-route-map';
import { formatAvailableSeats, formatSeats } from '../../../../shared/utils/seats.util';
import { vehicleDisplayName } from '../../../../shared/utils/vehicle-display.util';
import {
  getFirstName,
  TripDriver as TripDriverComponent,
} from '../../../matching/trip-driver/trip-driver';
import { formatTime } from '../../../matching/trip-results';
import { numberFormat } from '../../../../core/i18n/app-locale';

const RATING_FORMAT = () =>
  numberFormat({
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

// «Tu recorrido» y «Conductor y coche» en el detalle de la solicitud del
// pasajero: el mapa con su punto de recogida, las paradas con sus horas,
// los datos clave y el coche con el color traducido y su muestra
@Component({
  selector: 'app-passenger-request-route',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    RouteTimeline,
    TripDriverComponent,
    TripRouteMap,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './passenger-request-route.html',
  styleUrl: './passenger-request-route.scss',
})
export class PassengerRequestRoute {
  private readonly tripsService = inject(TripsService);
  private readonly colors = inject(VehicleColorsStore);
  private readonly travelPreferences = inject(TravelPreferencesStore);
  private readonly tripCall = inject(TripCallService);
  private readonly modalController = inject(ModalController);

  readonly request = input.required<SeatRequest>();
  readonly trip = input.required<Trip>();
  // Qué tarjetas pinta: el recorrido, «Conductor y coche» o las dos (en el
  // detalle de la solicitud, el conductor va en la columna de 4)
  readonly part = input<'route' | 'driver' | 'all'>('all');

  readonly routeResource = resource({
    params: () => this.trip().id,
    loader: ({ params: tripId }) => this.tripsService.getRoute(tripId),
  });
  readonly route = computed(() =>
    this.routeResource.hasValue() ? this.routeResource.value() : null,
  );

  // El teléfono del conductor, solo con la plaza aceptada
  private readonly contactsData = resource({
    params: () => (this.request().status === 'accepted' ? this.trip().id : undefined),
    loader: ({ params: tripId }) => this.tripCall.loadContacts(tripId),
  });
  readonly driverContact = computed<ChatContact | null>(() => {
    const list = this.contactsData.hasValue() ? this.contactsData.value() : [];
    return list.find((contact) => contact.role === 'driver') ?? null;
  });

  readonly pickupPoints = computed<RoutePoint[]>(() => {
    const request = this.request();
    const trip = this.trip();
    const label = this.pickupName();
    if (request.pickupLocation) {
      return [{ coordinates: request.pickupLocation.coordinates, label }];
    }
    if (request.direction === 'from-campus') {
      return [{ coordinates: trip.origin.coordinates, label }];
    }
    return [];
  });

  readonly mapEnds = computed<{ origin: RoutePoint; destination: RoutePoint }>(() => {
    const trip = this.trip();
    const request = this.request();
    const isToCampus = request.direction !== 'from-campus';
    const isApproximate = Boolean(trip.isLocationApproximate && request.status !== 'accepted');
    return {
      origin: {
        coordinates: trip.origin.coordinates,
        label: trip.originName ?? translate('screens.passengerRequestRoute.salidaConductor'),
        isApproximate: isApproximate && isToCampus,
      },
      destination: {
        coordinates: trip.destination.coordinates,
        label: trip.destinationName ?? translate('screens.passengerRequestRoute.destinoViaje'),
        isApproximate: isApproximate && !isToCampus,
      },
    };
  });

  readonly pickupName = computed(() => {
    const request = this.request();
    const trip = this.trip();
    return (
      request.pickupName ??
      (request.direction === 'from-campus'
        ? trip.originName
        : translate('screens.passengerRequestRoute.puntoRecogida')) ??
      translate('screens.passengerRequestRoute.puntoRecogida')
    );
  });

  readonly stops = computed<RouteStop[]>(() => {
    const request = this.request();
    const trip = this.trip();
    const durationMin = this.route()?.durationMin;
    const arrival =
      durationMin === undefined
        ? undefined
        : formatTime(new Date(Date.parse(trip.departureAt) + durationMin * 60_000).toISOString());
    const result: RouteStop[] = [
      {
        name: trip.originName ?? translate('screens.passengerRequestRoute.salidaConductor'),
        detail: translate('screens.passengerRequestRoute.salidaConductor'),
        time: formatTime(trip.departureAt),
      },
    ];
    // Sin hora: la estimada no suma las recogidas de otros pasajeros
    // (pendiente de decidir con el director)
    if (request.direction || request.pickupName || request.pickupLocation) {
      result.push({
        name: this.pickupName(),
        detail: translate('screens.passengerRequestRoute.puntoRecogida'),
      });
    }
    result.push({
      name: trip.destinationName ?? translate('screens.passengerRequestRoute.destinoViaje'),
      detail: translate('screens.passengerRequestRoute.llegadaAproximada'),
      time: arrival,
    });
    return result;
  });

  readonly facts = computed(() => {
    const request = this.request();
    const trip = this.trip();
    return [
      {
        label: translate('screens.passengerRequestRoute.plazasPides'),
        value: formatSeats(request.seats),
      },
      {
        label: translate('screens.passengerRequestRoute.plazasLibres'),
        value: formatAvailableSeats(trip.availableSeats, trip.offeredSeats),
      },
    ];
  });

  readonly driver = computed<TripDriver>(() => {
    const { driver } = this.trip();
    return {
      id: driver.id,
      name: driver.name,
      avatarKey: driver.avatarKey,
      tripCount: driver.tripCount,
      rating: driver.rating ?? undefined,
      isEmailVerified: true,
    };
  });

  readonly preferences = computed(() =>
    this.travelPreferences.format(this.trip().driver.preferences),
  );

  readonly rating = computed(() => {
    const { rating } = this.driver();
    return rating === undefined ? null : RATING_FORMAT().format(rating);
  });

  protected readonly upIcon = thumbsUp;
  protected readonly downIcon = thumbsDown;

  async openReviews(): Promise<void> {
    const { id, name } = this.driver();
    const { DriverReviewsModal } =
      await import('../../../matching/driver-reviews-modal/driver-reviews-modal');
    const modal = await this.modalController.create({
      component: DriverReviewsModal,
      cssClass: 'info-dialog',
      componentProps: { driverId: id, driverName: name },
    });
    await modal.present();
  }

  readonly hasChat = computed(() => {
    const { status: requestStatus } = this.request();
    const { status: tripStatus } = this.trip();
    return (
      requestStatus === 'accepted' && (tripStatus === 'confirmed' || tripStatus === 'in_progress')
    );
  });

  protected readonly carIcon = carOutline;
  protected readonly callIcon = callOutline;
  protected readonly chatIcon = chatbubblesOutline;
  protected readonly vehicleName = vehicleDisplayName;
  protected readonly vehicleColor = (color: string | null) => this.colors.label(color);
  protected readonly vehicleSwatch = (color: string | null) => this.colors.swatch(color);

  chatDriverLabel(): string {
    const name = getFirstName(this.trip().driver.name);
    return `Escribir a ${name}`;
  }

  canCallDriver(): boolean {
    return this.tripCall.canCall(this.trip().status, this.driverContact());
  }

  callDriverLabel(): string {
    const name = getFirstName(this.trip().driver.name);
    return this.tripCall.callLabel(this.driverContact(), name);
  }

  handleCallDriver(): void {
    this.tripCall.call(this.driverContact(), this.trip().status);
  }
}
