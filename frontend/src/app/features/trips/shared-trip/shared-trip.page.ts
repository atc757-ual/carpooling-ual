import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonToolbar,
} from '@ionic/angular';
import {
  callOutline,
  carOutline,
  checkmarkCircleOutline,
  linkOutline,
  timeOutline,
} from 'ionicons/icons';
import { defer, switchMap, takeWhile, timer } from 'rxjs';
import { ApiError } from '../../../core/models/api-error.model';
import { SharedTrip } from '../../../core/models/trip-share.model';
import { TripLiveShareService } from '../../../core/services/trips/trip-live-share.service';
import { TripRouteMap } from '../../../shared/components/ui/trip-route-map/trip-route-map';
import { injectLiveSheet } from '../../../shared/utils/desktop-query.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatTime } from '../../matching/trip-results';
import { LiveTripSheet } from '../live-trip-hero.util';
import {
  describeSharedTrip,
  describeSharedVehicle,
  isPositionStale,
  routeEnds,
} from './shared-trip.utils';

const POLL_MS = 10_000;
const OPEN_STATUSES = new Set(['confirmed', 'in_progress']);

// El viaje que un pasajero comparte en directo, para alguien de su confianza
// que lo abre sin cuenta (/seguir/:token), con su cabecera y en 8 + 4 como
// «En curso»: antes de salir o terminado, el estado en la columna de 8 y el
// detalle en la de 4; en curso, el mapa con el coche en la de 8 (en el móvil,
// de fondo, con el detalle en la hoja inferior). Mientras está abierto, «¿Algo
// va mal?» con el 112 y la matrícula. Se actualiza cada 10 s mientras el viaje
// está abierto; terminado, se para. No se indexa (el enlace es secreto)
@Component({
  selector: 'app-shared-trip-page',
  imports: [
    NgTemplateOutlet,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonToolbar,
    LiveTripSheet,
    TripRouteMap,
  ],
  templateUrl: './shared-trip.page.html',
  styleUrl: './shared-trip.page.scss',
})
export class SharedTripPage {
  private readonly liveShare = inject(TripLiveShareService);

  readonly token = input.required<string>();

  // Cada 10 s mientras el viaje está abierto; la última respuesta (la que
  // cierra el viaje) también se muestra
  readonly shared = rxResource<SharedTrip, string>({
    params: () => this.token(),
    stream: ({ params }) =>
      timer(0, POLL_MS).pipe(
        switchMap(() => defer(() => this.liveShare.getShared(params))),
        takeWhile((trip) => OPEN_STATUSES.has(trip.tripStatus), true),
      ),
  });
  readonly trip = computed(() => (this.shared.hasValue() ? this.shared.value() : null));
  readonly errorMessage = computed(() => {
    const error = this.shared.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });
  readonly status = computed(() => {
    const trip = this.trip();
    return trip ? describeSharedTrip(trip, 'El pasajero') : null;
  });
  // Abierto (confirmado o en curso): se ofrece el 112. En curso y con la
  // ruta: el mapa con el coche
  readonly isOpen = computed(() => OPEN_STATUSES.has(this.trip()?.tripStatus ?? ''));
  readonly isLive = computed(
    () => this.trip()?.tripStatus === 'in_progress' && this.mapEnds() !== null,
  );
  // La hoja inferior del móvil, la misma que en «En curso»
  readonly sheet = injectLiveSheet(/^\/seguir\//);
  readonly vehicleText = computed(() => describeSharedVehicle(this.trip()?.vehicle ?? null));
  readonly mapEnds = computed(() => {
    const trip = this.trip();
    return trip?.route ? routeEnds(trip.route, trip.destinationName) : null;
  });
  readonly carPoint = computed(() => {
    const position = this.trip()?.position;
    return position
      ? { coordinates: position.location.coordinates, label: 'el coche, ahora' }
      : null;
  });
  readonly isStale = computed(() => {
    const position = this.trip()?.position;
    return position ? isPositionStale(position.recordedAt, Date.now()) : false;
  });

  protected readonly formatTime = formatTime;
  protected readonly carIcon = carOutline;
  protected readonly linkIcon = linkOutline;
  protected readonly callIcon = callOutline;
  protected readonly timeIcon = timeOutline;
  protected readonly doneIcon = checkmarkCircleOutline;

  constructor() {
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    inject(DestroyRef).onDestroy(() => meta.removeTag('name="robots"'));
  }
}
