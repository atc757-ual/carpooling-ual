import { Component, computed, DestroyRef, effect, inject, resource, signal } from '@angular/core';
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
import { callOutline, locationOutline } from 'ionicons/icons';
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
import { TripChatLink } from '../../../shared/components/ui/trip-chat-link/trip-chat-link';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatTime } from '../../matching/trip-results';
import { formatSeats } from '../../../shared/utils/seats.util';
import { finishTrip } from '../finish-trip.util';
import { LiveTripMap } from '../passenger-requests/live-trip-map/live-trip-map';
import { TripProgress } from '../trip-progress/trip-progress';

// Una recogida sigue siendo «la siguiente» hasta 5 min después de su hora
// (lo que se espera al pasajero antes de poder marcar «No se presentó»)
const PICKUP_GRACE_MS = 5 * 60 * 1000;
const CLOCK_UPDATE_MS = 60_000;

// Pantalla del viaje en curso del conductor (/tabs/trips/drive/:id): el
// progreso, el mapa con su posición y la siguiente recogida, sus pasajeros
// con la hora y el punto de recogida y «Terminar viaje». Mientras está abierta
// se sigue compartiendo la posición (DriverTrackingService); al terminar,
// vuelve a Tus viajes
@Component({
  selector: 'app-driver-live-trip',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonSpinner,
    LiveTripMap,
    RouterLink,
    TripChatLink,
    TripProgress,
  ],
  templateUrl: './driver-live-trip.page.html',
  styleUrl: './driver-live-trip.page.scss',
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

  readonly isSharing = computed(() => this.tracking.tripId() === this.trip()?.id);
  readonly isScreenKeptOn = this.tracking.isScreenKeptOn;
  readonly gapMinutes = this.tracking.gapMinutes;
  readonly isFinishing = signal(false);
  readonly isPageVisible = signal(true);
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
  protected readonly callIcon = callOutline;
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

  ionViewWillEnter(): void {
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

  // «Recoger a las 09:12 · Av. del Mediterráneo»
  protected pickupLabel(request: SeatRequest): string {
    const at = request.pickupAt ? `Recoger a las ${formatTime(request.pickupAt)}` : 'Recoger';
    return request.pickupName ? `${at} · ${request.pickupName}` : at;
  }

  dismissGap(): void {
    this.tracking.dismissGap();
  }

  async handleFinish(): Promise<void> {
    const trip = this.trip();
    if (!trip) {
      return;
    }
    this.isFinishing.set(true);
    const deps = {
      confirm: this.confirm,
      driver: this.driver,
      tracking: this.tracking,
      toast: this.toast,
      location: this.location,
    };
    if (await finishTrip(deps, trip, this.locationIcon)) {
      await this.router.navigateByUrl('/tabs/trips');
    }
    this.isFinishing.set(false);
  }
}

// Sin hora de recogida, al final
function pickupTime(request: SeatRequest): number {
  return request.pickupAt ? Date.parse(request.pickupAt) : Number.POSITIVE_INFINITY;
}
