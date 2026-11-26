import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Co2Source } from '../../../shared/components/ui/co2-source/co2-source';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  resource,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
} from '@ionic/angular';
import {
  carOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  leafOutline,
  peopleOutline,
} from 'ionicons/icons';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { ReviewTarget, TripReviewCard } from '../trip-review/trip-review-card';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { tripStatusLabel } from '../../../shared/utils/trip-status.util';
import { co2KgForKm, estimateTripImpact, formatAmount } from '../../matching/trip-impact';
import { TripsService } from '../../../core/services/trips/trips.service';
import { formatTime } from '../../matching/trip-results';
import { DriverTripActions } from '../driver-trip-actions/driver-trip-actions';
import { DriverTripPassengers } from '../driver-trip-passengers/driver-trip-passengers';
import { DriverTripRoute } from '../driver-trip-route/driver-trip-route';
import { LiveTripBanner } from '../my-trips/live-trip-banner/live-trip-banner';
import { occupiedSeats } from '../my-trips/my-trips-summary';
import { LoadingState } from '../../../shared/components/ui/loading-state/loading-state';
import { QuickFaqs } from '../../../shared/components/ui/quick-faqs/quick-faqs';
import { localizedComputed } from '../../../core/i18n/localized-computed';

const FINISHED_KEY = 'screens.driverTripActions.esteViajeYaTermino';

// El aviso de cómo acabó el viaje: sus frases, su icono y su color
interface StatusNotice {
  keys: string[];
  icon: string;
  tone: 'success' | 'danger' | 'warning';
}

// El detalle de un viaje publicado. En escritorio, columna de 8 con el
// recorrido (mapa, paradas, datos y vehículo) y los pasajeros (plazas,
// solicitudes y chat); a la derecha, la de 4 con lo que se puede hacer
// (iniciar, terminar, cancelar) y el impacto estimado. En el móvil, todo en
// una columna. Cuándo, el estado y el papel van en la franja fija del título
// (HeadingContentService), como el chat
@Component({
  selector: 'app-driver-trip-detail',
  imports: [
    Co2Source,
    LoadingState,
    QuickFaqs,
    RouterLink,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    DriverTripActions,
    DriverTripPassengers,
    DriverTripRoute,
    LiveTripBanner,
    TripReviewCard,
    TranslocoPipe,
  ],
  templateUrl: './driver-trip-detail.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './driver-trip-detail.page.scss'],
})
export class DriverTripDetailPage {
  private readonly driver = inject(DriverService);
  private readonly tripsService = inject(TripsService);
  private readonly headingContent = inject(HeadingContentService);

  readonly id = input.required<string>();
  private readonly tripHeading = viewChild.required<TemplateRef<unknown>>('tripHeading');
  // A la vista: al volver a la pantalla, las pestañas ya han limpiado la franja
  private readonly isVisible = signal(true);

  constructor() {
    effect(() => {
      const template = this.tripHeading();
      if (this.isVisible() && this.trip()) {
        this.headingContent.show(template);
      } else {
        this.headingContent.clear(template);
      }
    });
    inject(DestroyRef).onDestroy(() => this.headingContent.clear(this.tripHeading()));
  }

  // Tras la navegación (que limpia la franja), la vuelve a poner
  ionViewDidEnter(): void {
    this.isVisible.set(true);
  }

  ionViewWillLeave(): void {
    this.isVisible.set(false);
  }

  // Terminado: los pasajeros que tuvieron plaza, para valorarlos (RF-22)
  private readonly finishedRequests = resource({
    params: () => (this.trip()?.status === 'finished' ? this.trip()?.id : undefined),
    loader: ({ params: tripId }) => this.driver.listTripRequests(tripId),
  });
  readonly reviewTargets = computed<ReviewTarget[]>(() =>
    (this.finishedRequests.hasValue() ? this.finishedRequests.value() : [])
      .filter((request) => request.status === 'accepted' || request.status === 'completed')
      .map((request) => ({ id: request.passenger.id, name: getFirstName(request.passenger.name) })),
  );

  readonly tripResource = resource({
    params: () => this.id(),
    loader: ({ params: id }) => this.driver.getMyTrip(id),
  });
  readonly trip = computed(() => (this.tripResource.hasValue() ? this.tripResource.value() : null));

  // «Mañana · 08:00»
  readonly when = localizedComputed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    const day = new Date(trip.departureAt).toLocaleDateString('sv-SE');
    return `${formatDateLabel(day)} · ${formatTime(trip.departureAt)}`;
  });
  readonly statusLabel = localizedComputed(() => {
    const trip = this.trip();
    return trip ? tripStatusLabel(trip.status) : '';
  });

  // Los pasajeros con plaza (0 en un viaje cancelado: no hubo viaje)
  private readonly passengers = computed(() => {
    const trip = this.trip();
    return !trip || trip.status === 'cancelled' ? 0 : trip.offeredSeats - trip.availableSeats;
  });

  // La ruta del viaje (solo con pasajeros): sus km directos (sin recogidas)
  // son los del impacto
  private readonly routeResource = resource({
    params: () => (this.passengers() > 0 ? this.trip()?.id : undefined),
    loader: ({ params: tripId }) => this.tripsService.getRoute(tripId),
  });

  // Con pasajeros, el CO₂ que no se emitió (el de un coche en ese trayecto
  // por cada uno) y los km compartidos, como en Tus viajes: con los km de la
  // ruta directa de OSRM o, sin ella, la aproximación en línea recta
  readonly impact = localizedComputed(() => {
    const trip = this.trip();
    const passengers = this.passengers();
    if (!trip || passengers === 0) {
      return null;
    }
    const routeKm = this.routeResource.hasValue()
      ? this.routeResource.value().directDistanceKm
      : undefined;
    const km =
      routeKm ?? estimateTripImpact(trip.origin.coordinates, trip.destination.coordinates)?.km ?? 0;
    return {
      co2: formatAmount(Math.round(co2KgForKm(km) * passengers * 10) / 10, 'kg'),
      km: formatAmount(Math.round(km * 10) / 10, 'km'),
    };
  });

  // Sin cifras, por qué, con su icono del color de su tipo: cancelado (rojo,
  // como el estado), hecho sin pasajeros (ámbar) o aún sin ellos (azul)
  readonly impactNote = computed(() => {
    const status = this.trip()?.status;
    if (status === 'cancelled') {
      return { key: 'myTrips.esteViajeRealizoAsi', icon: closeCircleOutline, tone: 'danger' };
    }
    return status === 'finished'
      ? { key: 'myTrips.sinPasajerosHecho', icon: carOutline, tone: 'warning' }
      : { key: 'myTrips.sinPasajerosAun', icon: peopleOutline, tone: 'info' };
  });

  protected readonly carIcon = carOutline;
  protected readonly leafIcon = leafOutline;

  // Cancelado o expirado: sin nada que hacer ni que contar (la columna de 4
  // solo con el aviso, publicar otro viaje y las preguntas)
  readonly isClosed = computed(() => {
    const status = this.trip()?.status;
    return status === 'cancelled' || status === 'expired';
  });

  // El aviso de cómo acabó el viaje, arriba de la columna de 4 y del color de
  // su estado, como la etiqueta de la cabecera: terminado en verde (con el
  // motivo si lo cerró el sistema), cancelado en rojo y sin pasajeros en
  // ámbar con el coche, como su nota de impacto
  readonly statusNotice = computed<StatusNotice | null>(() => {
    const trip = this.trip();
    switch (trip?.status) {
      case 'finished':
        return {
          keys:
            trip.finishedBy === 'system'
              ? [FINISHED_KEY, 'myTrips.cerradoAutomaticamenteHabiaPasado']
              : [FINISHED_KEY],
          icon: checkmarkCircleOutline,
          tone: 'success',
        };
      case 'cancelled':
        return {
          keys: ['screens.driverTripActions.esteViajeCancelo'],
          icon: closeCircleOutline,
          tone: 'danger',
        };
      case 'expired':
        return {
          keys: ['screens.driverTripActions.esteViajeSinPasajeros'],
          icon: carOutline,
          tone: 'warning',
        };
      default:
        return null;
    }
  });

  // El papel en el título: «Condujiste» si se hizo, «Ibas a conducir» si se
  // canceló o caducó y «Conduces» si está por hacer o en curso
  readonly roleKey = computed(() => {
    if (this.trip()?.status === 'finished') {
      return 'labels.role.drove';
    }
    return this.isClosed() ? 'labels.role.wasDriving' : 'labels.role.driving';
  });

  // Con el viaje en curso, el mismo aviso que en Tus viajes, que lleva a En curso
  readonly liveBanner = localizedComputed(() => {
    const trip = this.trip();
    if (trip?.status !== 'in_progress') {
      return null;
    }
    return {
      trip,
      detail: translate('screens.driverTripDetail.plazasOcupadas', {
        value1: occupiedSeats(trip),
        offeredSeats: trip.offeredSeats,
      }),
      link: `/tabs/trips/drive/${trip.id}`,
    };
  });

  handleReload(): void {
    this.tripResource.reload();
  }
}
