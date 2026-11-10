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
import { callOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { ChatContact } from '../../../core/models/chat.model';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest, SeatRequestStatus } from '../../../core/models/seat-request.model';
import { TravelPreferencesStore } from '../../../core/services/catalogs/travel-preferences.store';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripChatLink } from '../../../shared/components/ui/trip-chat-link/trip-chat-link';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatSeats } from '../../../shared/utils/seats.util';

const REQUEST_STATUS_LABELS: Record<SeatRequestStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'No aceptada',
  cancelled: 'Cancelada',
  expired: 'Caducada',
};
// Solo en estos se piden y deciden plazas
const OPEN_STATUSES: ReadonlySet<TripStatus> = new Set(['published', 'confirmed']);
const CHAT_STATUSES: ReadonlySet<TripStatus> = new Set(['confirmed', 'in_progress']);

// «Pasajeros» en el detalle de un viaje del conductor: las plazas como
// asientos (ocupados y libres), las solicitudes del viaje abierto (las
// prioritarias primero) con «Aceptar» y «Rechazar» en las pendientes y la
// llamada a los aceptados, y el chat del viaje. Avisa con «changed» al
// decidir una, porque cambian las plazas y quizá el estado
@Component({
  selector: 'app-driver-trip-passengers',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    TripChatLink,
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

  readonly isOpen = computed(() => OPEN_STATUSES.has(this.trip().status));
  // El chat existe desde que hay pasajeros aceptados (confirmado) y en curso
  readonly hasChat = computed(() => CHAT_STATUSES.has(this.trip().status));

  // Un asiento por plaza ofrecida: los primeros, ocupados
  readonly seats = computed(() => {
    const { offeredSeats, availableSeats } = this.trip();
    const taken = offeredSeats - availableSeats;
    return Array.from({ length: offeredSeats }, (_, index) => index < taken);
  });
  readonly seatsLabel = computed(() => {
    const { offeredSeats, availableSeats } = this.trip();
    return `${offeredSeats - availableSeats} de ${offeredSeats} plazas ocupadas`;
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
  // La solicitud que se está decidiendo
  readonly deciding = signal<string | null>(null);

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

  canCallPassenger(passengerId: string): boolean {
    const contact = this.contactsMap().get(passengerId);
    return this.tripCall.canCall(this.trip().status, contact);
  }

  callPassengerLabel(name: string, passengerId: string): string {
    const contact = this.contactsMap().get(passengerId);
    return this.tripCall.callLabel(contact, name);
  }

  handleCallPassenger(passenger: { id: string; name: string }): void {
    const contact = this.contactsMap().get(passenger.id);
    this.tripCall.call(contact, this.trip().status);
  }

  protected requestLabel(status: SeatRequestStatus): string {
    return REQUEST_STATUS_LABELS[status];
  }

  protected passengerPreferences(request: SeatRequest): string[] {
    return this.travelPreferences.format(request.passenger.preferences);
  }

  async handleDecide(request: SeatRequest, decision: 'accept' | 'reject'): Promise<void> {
    this.deciding.set(request.id);
    try {
      await this.driver.decideRequest(request.id, decision);
      const verb = decision === 'accept' ? 'aceptado' : 'rechazado';
      void this.toast.showSuccess(`Has ${verb} la solicitud de ${request.passenger.name}.`);
      this.requests.reload();
      this.changed.emit();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.deciding.set(null);
    }
  }
}
