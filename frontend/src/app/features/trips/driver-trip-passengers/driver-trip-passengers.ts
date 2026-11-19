import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { RouterLink } from '@angular/router';

type RequestDecision = 'accept' | 'reject';
import { callOutline, chatbubblesOutline, locationOutline, sparklesOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { ChatContact } from '../../../core/models/chat.model';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest, SeatRequestStatus } from '../../../core/models/seat-request.model';
import { TravelPreferencesStore } from '../../../core/services/catalogs/travel-preferences.store';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatSeats } from '../../../shared/utils/seats.util';
import { getFirstName, getInitials } from '../../matching/trip-driver/trip-driver';
import { lazyLabels } from '../../../core/i18n/lazy-labels';
import { LoadingState } from '../../../shared/components/ui/loading-state/loading-state';

const REQUEST_STATUS_LABELS: Readonly<Record<SeatRequestStatus, string>> = lazyLabels({
  pending: 'screens.driverTripPassengers.status.pending',
  accepted: 'screens.driverTripPassengers.status.accepted',
  rejected: 'screens.driverTripPassengers.status.rejected',
  cancelled: 'screens.driverTripPassengers.status.cancelled',
  expired: 'screens.driverTripPassengers.status.expired',
  completed: 'screens.driverTripPassengers.status.completed',
});
// Solo en estos se piden y deciden plazas
const OPEN_STATUSES: ReadonlySet<TripStatus> = new Set(['published', 'confirmed']);
const CHAT_STATUSES: ReadonlySet<TripStatus> = new Set(['confirmed', 'in_progress']);

// «Pasajeros» en el detalle de un viaje del conductor: las plazas como
// asientos (ocupados y libres), las solicitudes del viaje abierto (las
// prioritarias primero) con «Aceptar» y «Rechazar» en las pendientes y la
// llamada y el chat directo con cada aceptado. Avisa con «changed» al
// decidir una, porque cambian las plazas y quizá el estado
@Component({
  selector: 'app-driver-trip-passengers',
  imports: [
    LoadingState,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './driver-trip-passengers.html',
  styleUrl: './driver-trip-passengers.scss',
})
export class DriverTripPassengers {
  private readonly travelPreferences = inject(TravelPreferencesStore);
  private readonly driver = inject(DriverService);
  private readonly toast = inject(ToastService);
  private readonly tripCall = inject(TripCallService);

  readonly trip = input.required<DriverTrip>();
  readonly changed = output<void>();

  protected readonly passengerInitials = getInitials;

  readonly isOpen = computed(() => OPEN_STATUSES.has(this.trip().status));
  // El chat existe desde que hay pasajeros aceptados (confirmado) y en curso:
  // uno directo con cada pasajero
  readonly hasChat = computed(() => CHAT_STATUSES.has(this.trip().status));

  // Un asiento por plaza ofrecida: los primeros, ocupados
  readonly seats = computed(() => {
    const { offeredSeats, availableSeats } = this.trip();
    const taken = offeredSeats - availableSeats;
    return Array.from({ length: offeredSeats }, (_, index) => index < taken);
  });
  readonly seatsLabel = computed(() => {
    const { offeredSeats, availableSeats } = this.trip();
    return translate('screens.driverTripPassengers.plazasOcupadas', {
      value1: offeredSeats - availableSeats,
      offeredSeats,
    });
  });

  // Las solicitudes, solo de los viajes abiertos
  readonly requests = resource({
    params: () => (this.isOpen() ? this.trip().id : undefined),
    loader: ({ params: tripId }) => this.driver.listTripRequests(tripId),
  });
  readonly visibleRequests = computed(() =>
    (this.requests.hasValue() ? this.requests.value() : []).filter(
      ({ status }) => status === 'pending' || status === 'accepted',
    ),
  );
  // La solicitud que se está decidiendo y cómo (el spinner va en ese botón)
  readonly deciding = signal<{ id: string; decision: RequestDecision } | null>(null);

  // Los teléfonos para llamar, solo con el viaje abierto: resource y no
  // effect, para no pintar los de otro viaje si la respuesta llega tarde
  private readonly contactsData = resource({
    params: () => (this.isOpen() ? this.trip().id : undefined),
    loader: ({ params: tripId }) => this.tripCall.loadContacts(tripId),
  });
  readonly contacts = computed<ChatContact[]>(() =>
    this.contactsData.hasValue() ? this.contactsData.value() : [],
  );
  readonly contactsMap = computed(() => new Map(this.contacts().map((c) => [c.id, c])));

  protected readonly formatSeats = formatSeats;
  protected readonly callIcon = callOutline;
  protected readonly chatIcon = chatbubblesOutline;
  protected readonly locationIcon = locationOutline;
  protected readonly autoAcceptIcon = sparklesOutline;

  canCallPassenger(passengerId: string): boolean {
    const contact = this.contactsMap().get(passengerId);
    return this.tripCall.canCall(this.trip().status, contact);
  }

  // «Escribir a Pía»: abre la conversación directa con ese pasajero
  chatPassengerLabel(name: string): string {
    return translate('common.writeTo', { name: getFirstName(name) });
  }

  callPassengerLabel(name: string, passengerId: string): string {
    const contact = this.contactsMap().get(passengerId);
    return this.tripCall.callLabel(contact, name);
  }

  handleCallPassenger(passenger: { id: string; name: string }): void {
    const contact = this.contactsMap().get(passenger.id);
    this.tripCall.call(contact, this.trip().status);
  }

  protected requestLabel(request: SeatRequest): string {
    if (request.status === 'accepted' && this.trip().autoAccept) {
      return translate('screens.driverTripPassengers.status.autoAccepted');
    }
    return REQUEST_STATUS_LABELS[request.status];
  }

  protected passengerPreferences(request: SeatRequest): string[] {
    return this.travelPreferences.format(request.passenger.preferences);
  }

  // Solo el lugar: la hora estimada no suma las otras recogidas (pendiente
  // de decidir con el director)
  protected pickupSummary(request: SeatRequest): string | null {
    const place =
      request.direction === 'from-campus'
        ? translate('screens.driverTripPassengers.salida')
        : (request.pickupName ?? null);
    return place ? `Recogida: ${place}` : null;
  }

  isDeciding(requestId: string, decision: RequestDecision): boolean {
    const current = this.deciding();
    return current?.id === requestId && current.decision === decision;
  }

  async handleDecide(request: SeatRequest, decision: RequestDecision): Promise<void> {
    this.deciding.set({ id: request.id, decision });
    try {
      await this.driver.decideRequest(request.id, decision);
      const key = decision === 'accept' ? 'acceptedToast' : 'rejectedToast';
      void this.toast.showSuccess(
        translate(`screens.driverTripPassengers.${key}`, { name: request.passenger.name }),
      );
      this.requests.reload();
      this.changed.emit();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.deciding.set(null);
    }
  }
}
