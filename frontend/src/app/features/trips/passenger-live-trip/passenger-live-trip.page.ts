import { Component, computed, DestroyRef, inject, input, resource, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonContent, IonIcon } from '@ionic/angular';
import {
  businessOutline,
  callOutline,
  checkmarkCircle,
  chatbubblesOutline,
  documentTextOutline,
  homeOutline,
  locationOutline,
  paperPlaneOutline,
  personOutline,
  walkOutline,
  alertCircleOutline,
  timeOutline,
} from 'ionicons/icons';
import { ChatContact } from '../../../core/models/chat.model';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Translate } from '../../../core/i18n/translate';
import { LanguageService } from '../../../core/services/ui/language.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ApiError } from '../../../core/models/api-error.model';
import {
  injectLiveSheet,
  injectMatchesMedia,
  WIDE_ASIDE_MEDIA_QUERY,
} from '../../../shared/utils/desktop-query.util';
import { LicensePlate } from '../../../shared/components/ui/license-plate/license-plate';
import { vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { LiveTripMap, LiveTripStatus } from '../passenger-requests/live-trip-map/live-trip-map';
import {
  headingTo,
  isArriving,
  journeyStages,
  liveEtaText,
  LiveTripHero,
  LiveTripSheet,
  stageIndex,
} from '../live-trip-hero.util';
import { PassengerIncidentModal } from '../passenger-requests/passenger-incident-modal/passenger-incident-modal';
import { TripReviewForm } from '../trip-review/trip-review-form';
import { GivenReview } from '../../../core/services/users/trip-reviews.service';
import { RatingBar } from '../../../shared/components/ui/rating-bar/rating-bar';
import { ratingName } from '../../../shared/utils/rating.util';
import { PassengerRequestActions } from '../passenger-requests/passenger-request-actions/passenger-request-actions';
import { LiveTripSafety } from '../live-trip-safety/live-trip-safety';
import { buildLiveShareText } from '../trip-share-text';
import { RevealOnTouch, revealedHint } from '../../../shared/directives/reveal-on-touch.directive';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { LoadingState } from '../../../shared/components/ui/loading-state/loading-state';
import { ParticipantLink } from '../../../shared/components/ui/participant-link/participant-link';
import { EmptyState } from '../../../shared/components/ui/empty-state/empty-state';

// Cada cuánto se revisa si ya subió (código validado) o si el viaje terminó
const REFRESH_MS = 15_000;

// near: a menos de 300 m del campus; early: lejos (bajarse antes);
// default: en la vuelta
type ArriveCardVariant = 'near' | 'early' | 'default';

// Lo que se está confirmando en la hoja (sin ventana encima): «He llegado» o
// dejar de compartir el viaje en directo (con cómo hacerlo)
interface RideConfirm {
  kind: 'arrive';
}
// La URL de esta pantalla: la hoja del móvil solo está abierta en ella
const RIDE_URL = /^\/tabs\/trips\/ride\//;

const PASSENGER_STAGES = ['live.stages.pickup', 'live.stages.onBoard', 'live.stages.arrival'];

export type RidePhase = 'waiting' | 'on_board' | 'finished';

// En qué momento del viaje está el pasajero
export function ridePhase(request: SeatRequest, trip: Trip): RidePhase {
  if (trip.status === 'finished' || request.status === 'completed') {
    return 'finished';
  }
  return request.boardedAt ? 'on_board' : 'waiting';
}

// La clave del mensaje de un «He llegado» que no se pudo marcar
function arriveErrorKey(code: string): string {
  if (code === 'PASSENGER_NOT_BOARDED') {
    return 'live.arriveError.notBoarded';
  }
  if (code === 'TRIP_NOT_IN_PROGRESS') {
    return 'live.arriveError.notInProgress';
  }
  return 'live.arriveError.generic';
}

// «En curso» del pasajero (/tabs/trips/ride/:id, con el id de su solicitud):
// el mapa en vivo grande (toda la pantalla en el móvil) y, en la columna de 4
// (una hoja inferior que se arrastra en el móvil), en qué
// momento del viaje está, su código de recogida, el coche que tiene que
// buscar y sus acciones (chat, llamar, bajarse con incidencia)
@Component({
  selector: 'app-passenger-live-trip',
  imports: [
    ParticipantLink,
    EmptyState,
    LoadingState,
    NgTemplateOutlet,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    LicensePlate,
    LiveTripHero,
    LiveTripMap,
    LiveTripSafety,
    LiveTripSheet,
    PassengerIncidentModal,
    PassengerRequestActions,
    RatingBar,
    RevealOnTouch,
    TripReviewForm,
    TranslocoPipe,
  ],
  templateUrl: './passenger-live-trip.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './passenger-live-trip.page.scss'],
})
export class PassengerLiveTripPage {
  protected readonly waitingIcon = timeOutline;
  protected readonly alertIcon = alertCircleOutline;
  private readonly requests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);
  private readonly tripCall = inject(TripCallService);
  private readonly toast = inject(ToastService);
  private readonly tripShare = inject(TripShareService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService);
  private readonly translate: Translate = (key, params) => this.transloco.translate(key, params);

  readonly id = input.required<string>();

  readonly requestResource = resource({
    params: () => this.id(),
    loader: ({ params }): Promise<SeatRequest> => this.requests.getMine(params),
  });
  readonly request = computed(() =>
    this.requestResource.hasValue() ? this.requestResource.value() : null,
  );
  readonly tripResource = resource({
    params: () => this.request()?.trip.id,
    loader: ({ params }) => this.trips.getTrip(params),
  });
  readonly trip = computed(() => (this.tripResource.hasValue() ? this.tripResource.value() : null));
  // Para compartir el viaje con alguien de confianza: el trayecto, quién
  // conduce, el coche y la matrícula
  readonly safetyShareText = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    this.language.currentLanguage();
    return buildLiveShareText(trip, this.translate, {
      name: trip.driver.name,
      vehicleName: trip.vehicle ? vehicleDisplayName(trip.vehicle) : null,
      plate: this.request()?.vehiclePlate ?? null,
    });
  });

  readonly isLive = computed(() => {
    const request = this.request();
    const trip = this.trip();
    return request?.status === 'accepted' && trip?.status === 'in_progress';
  });
  readonly phase = computed<RidePhase | null>(() => {
    const request = this.request();
    const trip = this.trip();
    return request && trip ? ridePhase(request, trip) : null;
  });
  readonly driverName = computed(() => {
    const name = this.trip()?.driver.name;
    this.language.currentLanguage();
    return name ? getFirstName(name) : this.translate('live.theDriver');
  });
  readonly pickupName = computed(() => {
    const request = this.request();
    const trip = this.trip();
    this.language.currentLanguage();
    return (
      request?.pickupName ??
      (request?.direction === 'from-campus' ? trip?.originName : null) ??
      this.translate('live.yourPickup')
    );
  });
  // Adónde va: al campus, un edificio; de vuelta, una casa
  readonly destinationIcon = computed(() =>
    this.request()?.direction === 'from-campus' ? homeOutline : businessOutline,
  );
  readonly pickupLocation = computed(() => {
    const request = this.request();
    if (request?.pickupLocation) {
      return request.pickupLocation;
    }
    return request?.direction === 'from-campus' ? (this.trip()?.origin ?? null) : null;
  });

  // El teléfono del conductor, para llamarle si no lo encuentra
  private readonly contactsData = resource({
    params: () => (this.isLive() ? this.trip()?.id : undefined),
    loader: ({ params: tripId }) => this.tripCall.loadContacts(tripId),
  });
  private readonly driverContact = computed<ChatContact | null>(() => {
    const list = this.contactsData.hasValue() ? this.contactsData.value() : [];
    return list.find((contact) => contact.role === 'driver') ?? null;
  });

  readonly isPageVisible = signal(true);
  // Al llegar: valorar al conductor (RF-22). «Ahora no» lo deja para luego
  // (en el detalle del viaje)
  readonly reviewState = signal<'form' | 'sent' | 'skipped'>('form');

  // Tras valorar (u omitirlo): el resumen y «Ver tu viaje». La hoja se queda a
  // la altura que tenía durante el viaje (no salta)
  handleReviewDone(state: 'sent' | 'skipped', review: GivenReview | null = null): void {
    this.givenReview.set(review);
    this.reviewState.set(state);
  }
  // La valoración enviada, para el resumen (null si ya existía de antes)
  readonly givenReview = signal<GivenReview | null>(null);
  protected readonly ratingName = ratingName;
  // Registrando una incidencia: el formulario sustituye a todo lo demás
  readonly isReportingIncident = signal(false);
  // Lo que el mapa sabe en directo (minutos hasta la recogida y el destino)
  readonly liveStatus = signal<LiveTripStatus | null>(null);
  readonly etaText = computed(() => {
    this.language.currentLanguage();
    return liveEtaText(this.liveStatus(), this.phase() === 'waiting', {
      keys: { pickup: 'live.hero.arrivesIn', stale: 'live.hero.noPosition' },
      translate: this.translate,
    });
  });
  readonly isToCampus = computed(() => this.request()?.direction !== 'from-campus');
  // A bordo y a menos de 300 m del campus: «Llegada» pasa a ser la etapa actual
  readonly isNearDestination = computed(
    () =>
      this.phase() === 'on_board' &&
      this.isToCampus() &&
      isArriving(this.liveStatus()?.destinationMeters ?? null),
  );
  // La tarjeta de «He llegado» (a bordo): en la ida, destacada a menos de
  // 300 m del campus y discreta lejos; en la vuelta cada pasajero se baja en
  // un sitio (aún no se mide la distancia a su punto), así que va siempre
  readonly arriveCard = computed<ArriveCardVariant | null>(() => {
    if (this.phase() !== 'on_board') return null;
    if (!this.isToCampus()) return 'default';
    return this.isNearDestination() ? 'near' : 'early';
  });
  // Móvil: qué hace el botón desplegado de la fila de acciones
  protected readonly revealedHint = revealedHint;
  protected readonly shareIcon = paperPlaneOutline;
  protected readonly reportIcon = documentTextOutline;

  // Compartir el viaje con alguien de confianza (el menú del sistema)
  async handleShareTrip(): Promise<void> {
    await this.tripShare.share({
      title: this.translate('share.liveTitle'),
      text: this.safetyShareText(),
    });
  }
  readonly heroTitle = computed(() => {
    this.language.currentLanguage();
    return this.phase() === 'waiting'
      ? this.translate('live.hero.waitingFor', { name: this.driverName() })
      : this.translate(headingTo(this.isToCampus(), this.isNearDestination()));
  });
  readonly stages = computed(() => {
    this.language.currentLanguage();
    return journeyStages(
      PASSENGER_STAGES.map((key) => this.translate(key)),
      stageIndex(this.phase() === 'waiting', this.isNearDestination()),
    );
  });
  readonly sheet = injectLiveSheet(RIDE_URL);
  // Las acciones (llegada, compartir, reportar, SOS) en filas con su texto
  // solo si la columna de 4 tiene sitio; si no (móvil y tabletas), en la fila
  // de botones cortos
  private readonly isWideAside = injectMatchesMedia(WIDE_ASIDE_MEDIA_QUERY);
  readonly hasActionRows = computed(() => this.sheet.isDesktop() && this.isWideAside());

  // Al terminar, la hoja no se mueve: la valoración cabe a la altura que tenía
  // durante el viaje, para que no suba sola
  constructor() {
    const timer = setInterval(() => {
      if (this.isPageVisible() && this.isLive()) {
        this.requestResource.reload();
        this.tripResource.reload();
      }
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ionViewWillEnter(): void {
    this.sheet.enter();
    this.isPageVisible.set(true);
  }

  ionViewWillLeave(): void {
    void this.sheet.close();
    this.isPageVisible.set(false);
  }

  async handleIncidentReported(): Promise<void> {
    this.isReportingIncident.set(false);
    void this.toast.showSuccess(this.translate('live.toast.incidentPassenger'));
    await this.sheet.close();
    await this.router.navigateByUrl('/tabs/trips');
  }

  // «He llegado»: cierra su plaza (vale lo primero que llegue, esto o el «Ha
  // bajado» del conductor). No se puede deshacer: se confirma antes
  readonly isArriving = signal(false);

  handleArrive(event?: Event): void {
    event?.preventDefault();
    const request = this.request();
    if (!request || this.isArriving()) {
      return;
    }
    this.pendingConfirm.set({ kind: 'arrive' });
  }

  // Lo que se confirma en la hoja y si se está guardando
  readonly pendingConfirm = signal<RideConfirm | null>(null);
  readonly isConfirming = signal(false);

  async handleConfirmPending(): Promise<void> {
    const pending = this.pendingConfirm();
    if (!pending || this.isConfirming()) {
      return;
    }
    this.isConfirming.set(true);
    try {
      await this.arrive();
    } finally {
      this.isConfirming.set(false);
      this.pendingConfirm.set(null);
    }
  }

  // «He llegado» confirmado: cierra su plaza
  private async arrive(): Promise<void> {
    const request = this.request();
    if (!request) {
      return;
    }
    this.isArriving.set(true);
    try {
      this.requestResource.set(await this.requests.arrive(request.id));
      this.tripResource.reload();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }
      void this.toast.showError(this.translate(arriveErrorKey(error.code)));
    } finally {
      this.isArriving.set(false);
    }
  }

  canCallDriver(): boolean {
    const trip = this.trip();
    return trip ? this.tripCall.canCall(trip.status, this.driverContact()) : false;
  }

  callDriverLabel(): string {
    return this.tripCall.callLabel(this.driverContact(), this.driverName());
  }

  handleCallDriver(): void {
    const trip = this.trip();
    if (trip) {
      this.tripCall.call(this.driverContact(), trip.status);
    }
  }

  protected readonly vehicleName = vehicleDisplayName;
  protected readonly callIcon = callOutline;
  protected readonly chatIcon = chatbubblesOutline;
  protected readonly doneIcon = checkmarkCircle;
  protected readonly personIcon = personOutline;
  protected readonly pinIcon = locationOutline;
  protected readonly arrivedIcon = walkOutline;
}
