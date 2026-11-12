import { Component, computed, DestroyRef, effect, inject, resource, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import {
  businessOutline,
  callOutline,
  checkmarkCircle,
  chatbubblesOutline,
  checkmark,
  flagOutline,
  homeOutline,
  locationOutline,
  personRemoveOutline,
} from 'ionicons/icons';
import { map } from 'rxjs';
import { ApiError } from '../../../core/models/api-error.model';
import { ChatContact } from '../../../core/models/chat.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { LocationService } from '../../../core/services/location/location.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { injectLiveSheet } from '../../../shared/utils/desktop-query.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatSeats } from '../../../shared/utils/seats.util';
import { isCampusName } from '../../matching/campus';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { ReviewTarget, TripReviewCard } from '../trip-review/trip-review-card';
import { checkFinish, completeFinish, FinishCheck, formatDistance } from '../finish-trip.util';
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

// Una recogida sigue siendo «la siguiente» hasta 5 min después de su hora
// (lo que se espera al pasajero antes de poder marcar «No se presentó»)
const PICKUP_GRACE_MS = 5 * 60 * 1000;
const CLOCK_UPDATE_MS = 60_000;
const DRIVER_STAGES = ['Recogidas', 'Al destino', 'Llegada'];
// La URL de esta pantalla: la hoja del móvil solo está abierta en ella
const DRIVE_URL = /^\/tabs\/trips\/drive\//;

// Pantalla del viaje en curso del conductor (/tabs/trips/drive/:id). En
// escritorio, el mapa (8) y los detalles (4); en el móvil, el mapa a toda la
// pantalla y los detalles en una hoja inferior que se arrastra. Detalles: lo
// siguiente que hay que hacer, el progreso, sus pasajeros
// con la hora y el punto de recogida y «Terminar viaje». Mientras está abierta
// se sigue compartiendo la posición (DriverTrackingService); al terminar,
// vuelve a Tus viajes
@Component({
  selector: 'app-driver-live-trip',
  imports: [
    NgTemplateOutlet,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonSpinner,
    LiveTripHero,
    LiveTripMap,
    LiveTripSheet,
    TripReviewCard,
    RouterLink,
  ],
  templateUrl: './driver-live-trip.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './driver-live-trip.page.scss'],
})
export class DriverLiveTripPage {
  private readonly driver = inject(DriverService);
  private readonly tracking = inject(DriverTrackingService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly tripCall = inject(TripCallService);
  private readonly location = inject(LocationService);
  private readonly router = inject(Router);

  private readonly tripId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  // El viaje sale de Mis viajes (el conductor solo ve los suyos)
  readonly tripResource = resource({
    params: () => this.tripId() || undefined,
    loader: async ({ params: id }) => {
      const trip = (await this.driver.listMyTrips()).find((candidate) => candidate.id === id);
      if (!trip) {
        throw new Error('Trip not found');
      }
      return trip;
    },
  });
  readonly trip = computed(() => (this.tripResource.hasValue() ? this.tripResource.value() : null));
  readonly isInProgress = computed(() => this.trip()?.status === 'in_progress');

  // Los pasajeros aceptados, por hora de recogida
  readonly requests = resource({
    params: () => (this.isInProgress() ? this.trip()?.id : undefined),
    loader: ({ params: id }) => this.driver.listTripRequests(id),
  });
  readonly passengers = computed(() =>
    (this.requests.hasValue() ? this.requests.value() : [])
      .filter(({ status }) => status === 'accepted')
      .sort((first, second) => pickupTime(first) - pickupTime(second)),
  );
  private readonly now = signal(Date.now());
  readonly nextPickup = computed(
    () =>
      this.passengers().find(
        (request) =>
          request.pickupLocation &&
          !request.boardedAt &&
          pickupTime(request) + PICKUP_GRACE_MS >= this.now(),
      ) ?? null,
  );

  readonly allOnBoard = computed(() =>
    this.passengers().every((request) => Boolean(request.boardedAt)),
  );
  // A quién toca validar: el primero, por orden de recogida, que no ha subido
  readonly activePickupId = computed(
    () => this.passengers().find((request) => !request.boardedAt)?.id ?? null,
  );
  // Recogidas hechas (o sin pasajeros): la etapa pasa a «Al destino»
  readonly arePickupsDone = computed(() => this.activePickupId() === null);
  // La tarjeta del carrusel que se ve (para los puntos)
  readonly carouselIndex = signal(0);
  // Adónde va: al campus, un edificio; de vuelta, una casa
  readonly destinationIcon = computed(() =>
    isCampusName(this.trip()?.destinationName) ? businessOutline : homeOutline,
  );
  readonly boardedCount = computed(
    () => this.passengers().filter((request) => Boolean(request.boardedAt)).length,
  );

  readonly isSharing = computed(() => this.tracking.tripId() === this.trip()?.id);
  readonly isScreenKeptOn = this.tracking.isScreenKeptOn;
  readonly gapMinutes = this.tracking.gapMinutes;
  readonly isFinishing = signal(false);
  // La respuesta a «Terminar viaje» (distancia al destino), mientras se confirma
  readonly finishCheck = signal<FinishCheck | null>(null);
  // Recién terminado aquí: la hoja enseña el aviso y la valoración de los
  // pasajeros en lugar de salir enseguida
  readonly justFinished = signal(false);
  readonly reviewTargets = computed<ReviewTarget[]>(() =>
    this.passengers().map((request) => ({
      id: request.passenger.id,
      name: getFirstName(request.passenger.name),
    })),
  );
  protected readonly formatDistance = formatDistance;
  readonly isPageVisible = signal(true);
  // Lo que el mapa sabe en directo (minutos hasta la recogida y el destino)
  readonly liveStatus = signal<LiveTripStatus | null>(null);
  readonly etaText = computed(() =>
    liveEtaText(
      this.liveStatus(),
      Boolean(this.nextPickup()),
      'En la recogida',
      'Sin tu ubicación',
    ),
  );
  readonly isToCampus = computed(() => isCampusName(this.trip()?.destinationName));
  // Recogidas hechas y a menos de 300 m del campus: «Llegada» es la etapa actual
  readonly isNearDestination = computed(
    () =>
      this.arePickupsDone() &&
      this.isToCampus() &&
      isArriving(this.liveStatus()?.destinationMeters ?? null),
  );
  readonly heroTitle = computed(() => {
    const next = this.nextPickup();
    return next
      ? `Recoge a ${getFirstName(next.passenger.name)}`
      : headingTo(this.isToCampus(), this.isNearDestination());
  });
  readonly stages = computed(() =>
    journeyStages(DRIVER_STAGES, stageIndex(!this.arePickupsDone(), this.isNearDestination())),
  );
  readonly sheet = injectLiveSheet(DRIVE_URL);
  // Los teléfonos para llamar: resource y no effect, para no pintar los de
  // otro viaje si la respuesta llega tarde
  private readonly contactsData = resource({
    params: () => this.trip()?.id,
    loader: ({ params: tripId }) => this.tripCall.loadContacts(tripId),
  });
  readonly contacts = computed<ChatContact[]>(() =>
    this.contactsData.hasValue() ? this.contactsData.value() : [],
  );
  readonly contactsMap = computed(() => new Map(this.contacts().map((c) => [c.id, c])));
  protected readonly locationIcon = locationOutline;
  protected readonly flagIcon = flagOutline;
  protected readonly firstName = (name: string) => getFirstName(name);
  protected readonly callIcon = callOutline;
  protected readonly doneIcon = checkmark;
  protected readonly finishedIcon = checkmarkCircle;
  protected readonly noShowIcon = personRemoveOutline;
  protected readonly chatIcon = chatbubblesOutline;
  protected readonly formatSeats = formatSeats;

  // Código de 4 cifras introducido para cada pasajero
  private readonly boardCodeMap = signal<Record<string, string>>({});
  private readonly validatingBoardMap = signal<Record<string, boolean>>({});

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), CLOCK_UPDATE_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // Si se entra con el viaje en curso, su posición se sigue enviando
    effect(() => {
      const trip = this.trip();
      if (trip?.status === 'in_progress') {
        this.tracking.start(trip.id);
      }
    });
    // Al validar a uno, el carrusel pasa solo al siguiente que toca
    effect(() => {
      const activeId = this.activePickupId();
      if (activeId) {
        setTimeout(() => this.scrollToPickup(activeId));
      }
    });
  }

  // La tarjeta que se ve, al deslizar el carrusel
  handleCarouselScroll(event: Event): void {
    const carousel = event.target as HTMLElement;
    if (carousel.clientWidth > 0) {
      this.carouselIndex.set(Math.round(carousel.scrollLeft / carousel.clientWidth));
    }
  }

  // Lleva el carrusel a la tarjeta de un pasajero (por su id: el contenido de
  // la hoja del móvil lo crea Ionic y un viewChild no lo vería)
  scrollToPickup(requestId: string): void {
    const slide = document.getElementById(`pickup-${requestId}`);
    const carousel = slide?.parentElement;
    if (slide && carousel) {
      carousel.scrollTo?.({ left: slide.offsetLeft - carousel.offsetLeft, behavior: 'smooth' });
    }
  }

  canCallPassenger(passengerId: string): boolean {
    const contact = this.contactsMap().get(passengerId);
    return this.tripCall.canCall(this.trip()?.status, contact);
  }

  callPassengerLabel(name: string, passengerId: string): string {
    const contact = this.contactsMap().get(passengerId);
    return this.tripCall.callLabel(contact, name);
  }

  handleCallPassenger(passenger: { id: string; name: string }): void {
    const contact = this.contactsMap().get(passenger.id);
    this.tripCall.call(contact, this.trip()?.status);
  }

  ionViewWillLeave(): void {
    void this.sheet.close();
  }

  ionViewWillEnter(): void {
    this.sheet.enter();
    this.isPageVisible.set(true);
  }

  ionViewDidLeave(): void {
    this.isPageVisible.set(false);
  }

  boardCode(requestId: string): string {
    return this.boardCodeMap()[requestId] ?? '';
  }

  // Lo que escribe el conductor en la casilla del código (un input nativo)
  handleBoardCodeInput(requestId: string, event: Event): void {
    this.setBoardCode(requestId, (event.target as HTMLInputElement).value);
  }

  setBoardCode(requestId: string, value: string): void {
    const sanitized = value.replace(/\D/g, '').slice(0, 4);
    this.boardCodeMap.update((current) => ({ ...current, [requestId]: sanitized }));
  }

  isValidatingBoard(requestId: string): boolean {
    return !!this.validatingBoardMap()[requestId];
  }

  private getPickupReferenceMs(request: SeatRequest): number {
    if (request.pickupAt) {
      return Date.parse(request.pickupAt);
    }
    const currentTrip = this.trip();
    if (currentTrip?.departureAt) {
      return Date.parse(currentTrip.departureAt);
    }
    return 0;
  }

  canMarkNoShow(request: SeatRequest): boolean {
    const reference = this.getPickupReferenceMs(request);
    return this.now() >= reference + PICKUP_GRACE_MS;
  }

  noShowWaitMinutes(request: SeatRequest): number {
    const reference = this.getPickupReferenceMs(request);
    const remainingMs = reference + PICKUP_GRACE_MS - this.now();
    return Math.max(1, Math.ceil(remainingMs / 60000));
  }

  async handleBoard(requestId: string): Promise<void> {
    const code = this.boardCode(requestId);
    if (code.length !== 4) {
      return;
    }
    this.validatingBoardMap.update((current) => ({ ...current, [requestId]: true }));
    try {
      await this.driver.boardPassenger(requestId, code);
      void this.toast.showSuccess('¡Recogida validada! Pasajero a bordo.');
      this.requests.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.validatingBoardMap.update((current) => ({ ...current, [requestId]: false }));
    }
  }

  async handleNoShow(requestId: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      header: '¿Marcar que no se presentó?',
      message:
        'Se liberará la plaza y se registrará como cancelación tardía del pasajero. Esta acción no se puede deshacer.',
      confirmText: 'Marcar no presentado',
      cancelText: 'Seguir esperando',
      isDestructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.driver.markNoShow(requestId);
      void this.toast.showSuccess('Pasajero marcado como no presentado.');
      this.requests.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }

  // Dónde recoger (sin hora por ahora: la estimada no suma las otras recogidas)
  protected pickupPlace(request: SeatRequest): string {
    if (request.direction === 'from-campus') {
      return 'En tu salida';
    }
    return request.pickupName ?? 'Su punto de recogida';
  }

  dismissGap(): void {
    this.tracking.dismissGap();
  }

  // «Terminar viaje»: mira a qué distancia está del destino y pregunta en la
  // última tarjeta (no en otra ventana)
  async handleFinish(): Promise<void> {
    const trip = this.trip();
    if (!trip || this.isFinishing()) {
      return;
    }
    this.isFinishing.set(true);
    this.finishCheck.set(await checkFinish(this.location, trip));
    this.isFinishing.set(false);
  }

  async confirmFinish(): Promise<void> {
    const trip = this.trip();
    const check = this.finishCheck();
    if (!trip || !check || this.isFinishing()) {
      return;
    }
    this.isFinishing.set(true);
    const deps = { driver: this.driver, tracking: this.tracking, toast: this.toast };
    if (await completeFinish(deps, trip.id, check.point)) {
      this.finishCheck.set(null);
      this.justFinished.set(true);
      this.sheet.expand();
    }
    this.isFinishing.set(false);
  }

  async leaveFinished(): Promise<void> {
    await this.sheet.close();
    await this.router.navigateByUrl('/tabs/trips');
  }

  cancelFinish(): void {
    this.finishCheck.set(null);
  }
}

// Sin hora de recogida, al final
function pickupTime(request: SeatRequest): number {
  return request.pickupAt ? Date.parse(request.pickupAt) : Number.POSITIVE_INFINITY;
}
