import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
} from '@ionic/angular';
import {
  businessOutline,
  callOutline,
  checkmarkCircle,
  chatbubblesOutline,
  homeOutline,
  locationOutline,
  personOutline,
} from 'ionicons/icons';
import { ChatContact } from '../../../core/models/chat.model';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import {
  injectIsDesktop,
  injectIsOnUrl,
  LIVE_SHEET_BREAKPOINTS,
  LIVE_SHEET_FULL_BREAKPOINT,
  LIVE_SHEET_INITIAL_BREAKPOINT,
  liveSheetInset,
} from '../../../shared/utils/desktop-query.util';
import { LicensePlate } from '../../../shared/components/ui/license-plate/license-plate';
import { vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { LiveTripMap, LiveTripStatus } from '../passenger-requests/live-trip-map/live-trip-map';
import { etaTag, headingTo, isArriving, journeyStages } from '../live-trip-hero.util';
import { PassengerIncidentModal } from '../passenger-requests/passenger-incident-modal/passenger-incident-modal';
import { TripReviewForm } from '../trip-review/trip-review-form';
import { PassengerRequestActions } from '../passenger-requests/passenger-request-actions/passenger-request-actions';

// Cada cuánto se revisa si ya subió (código validado) o si el viaje terminó
const REFRESH_MS = 15_000;
// La URL de esta pantalla: la hoja del móvil solo está abierta en ella
const RIDE_URL = /^\/tabs\/trips\/ride\//;

const PASSENGER_STAGES = ['Recogida', 'En el coche', 'Llegada'];

export type RidePhase = 'waiting' | 'on_board' | 'finished';

// En qué momento del viaje está el pasajero
export function ridePhase(request: SeatRequest, trip: Trip): RidePhase {
  if (trip.status === 'finished') {
    return 'finished';
  }
  return request.boardedAt ? 'on_board' : 'waiting';
}

// «En curso» del pasajero (/tabs/trips/ride/:id, con el id de su solicitud):
// el mapa en vivo grande (toda la pantalla en el móvil) y, en la columna de 4
// (una hoja inferior que se arrastra en el móvil), en qué
// momento del viaje está, su código de recogida, el coche que tiene que
// buscar y sus acciones (chat, llamar, bajarse con incidencia)
@Component({
  selector: 'app-passenger-live-trip',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonModal,
    IonSpinner,
    LicensePlate,
    LiveTripMap,
    PassengerIncidentModal,
    PassengerRequestActions,
    TripReviewForm,
  ],
  templateUrl: './passenger-live-trip.page.html',
  styleUrls: ['../../tabs/tab-page.scss', '../live-trip.scss', './passenger-live-trip.page.scss'],
})
export class PassengerLiveTripPage {
  private readonly requests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);
  private readonly tripCall = inject(TripCallService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  readonly requestResource = resource({
    params: () => this.id(),
    loader: async ({ params }): Promise<SeatRequest> => {
      const request = (await this.requests.listMine()).find((item) => item.id === params);
      if (!request) {
        throw new Error('Request not found');
      }
      return request;
    },
  });
  readonly request = computed(() =>
    this.requestResource.hasValue() ? this.requestResource.value() : null,
  );
  readonly tripResource = resource({
    params: () => this.request()?.trip.id,
    loader: ({ params }) => this.trips.getTrip(params),
  });
  readonly trip = computed(() => (this.tripResource.hasValue() ? this.tripResource.value() : null));

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
  readonly driverName = computed(() => getFirstName(this.trip()?.driver.name ?? 'El conductor'));
  readonly pickupName = computed(() => {
    const request = this.request();
    const trip = this.trip();
    return (
      request?.pickupName ??
      (request?.direction === 'from-campus' ? trip?.originName : null) ??
      'tu punto de recogida'
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
  // Registrando una incidencia: el formulario sustituye a todo lo demás
  readonly isReportingIncident = signal(false);
  // Lo que el mapa sabe en directo (minutos hasta la recogida y el destino)
  readonly liveStatus = signal<LiveTripStatus | null>(null);
  readonly etaText = computed(() => {
    const status = this.liveStatus();
    if (!status) {
      return null;
    }
    if (status.isStale) {
      return 'Sin posición';
    }
    if (this.phase() === 'waiting') {
      return status.pickupMinutes === null ? null : etaTag(status.pickupMinutes, 'Llega');
    }
    return status.destinationMinutes === null
      ? null
      : etaTag(status.destinationMinutes, 'En destino');
  });
  readonly isToCampus = computed(() => this.request()?.direction !== 'from-campus');
  // A bordo y a menos de 300 m del campus: «Llegada» pasa a ser la etapa actual
  readonly isNearDestination = computed(
    () =>
      this.phase() === 'on_board' &&
      this.isToCampus() &&
      isArriving(this.liveStatus()?.destinationMeters ?? null),
  );
  readonly heroTitle = computed(() =>
    this.phase() === 'waiting'
      ? `Esperando a ${this.driverName()}`
      : headingTo(this.isToCampus(), this.isNearDestination()),
  );
  readonly stages = computed(() => {
    let current = 1;
    if (this.phase() === 'waiting') {
      current = 0;
    } else if (this.isNearDestination()) {
      current = 2;
    }
    return journeyStages(PASSENGER_STAGES, current);
  });
  readonly isDesktop = injectIsDesktop();
  protected readonly sheetBreakpoints = LIVE_SHEET_BREAKPOINTS;
  protected readonly sheetInitialBreakpoint = LIVE_SHEET_INITIAL_BREAKPOINT;
  // La hoja no se cierra al arrastrarla en el móvil; sí al pasar a escritorio
  // o al salir de la pantalla (se pregunta en el momento: una función, no un
  // valor fijo, o se quedaría abierta encima del 8 + 4)
  readonly isOnPage = injectIsOnUrl(RIDE_URL);
  protected readonly canDismissSheet = (): Promise<boolean> =>
    Promise.resolve(this.isDesktop() || !this.isOnPage() || this.isLeaving);
  // Al salir (volver atrás destruye la pantalla), la hoja se cierra a mano:
  // Ionic la ha sacado de su sitio y, si no, se quedaría encima de la otra
  private readonly sheet = viewChild(IonModal);
  private isLeaving = false;
  private async closeSheet(): Promise<void> {
    this.isLeaving = true;
    await this.sheet()?.dismiss();
  }
  // Lo que tapa la hoja ahora (cambia al arrastrarla): el mapa encuadra encima
  readonly sheetBreakpoint = signal(LIVE_SHEET_INITIAL_BREAKPOINT);
  readonly mapInset = computed(() =>
    this.isDesktop() ? 0 : liveSheetInset(this.sheetBreakpoint()),
  );

  constructor() {
    effect(() => {
      if (this.phase() === 'finished') {
        void this.sheet()?.setCurrentBreakpoint(LIVE_SHEET_FULL_BREAKPOINT);
      }
    });
    effect(() => {
      if (!this.isOnPage()) {
        void this.closeSheet();
      }
    });
    inject(DestroyRef).onDestroy(() => void this.closeSheet());
    const timer = setInterval(() => {
      if (this.isPageVisible() && this.isLive()) {
        this.requestResource.reload();
        this.tripResource.reload();
      }
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  ionViewWillEnter(): void {
    this.isLeaving = false;
    this.isPageVisible.set(true);
  }

  ionViewWillLeave(): void {
    void this.closeSheet();
    this.isPageVisible.set(false);
  }

  async handleIncidentReported(): Promise<void> {
    this.isReportingIncident.set(false);
    void this.toast.showSuccess('Incidencia registrada. Tu plaza ha sido cancelada.');
    await this.closeSheet();
    await this.router.navigateByUrl('/tabs/trips');
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
}
