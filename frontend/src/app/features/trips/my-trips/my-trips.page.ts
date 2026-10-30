import { Component, computed, inject, linkedSignal, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonRouterLink,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, carOutline } from 'ionicons/icons';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ActiveModeService, TravelMode } from '../../../core/services/users/active-mode.service';
import { DriverTripCard } from '../driver-trip-card/driver-trip-card';
import { PassengerRequests } from '../passenger-requests/passenger-requests';

// Viajes que aún no han terminado
const UPCOMING: ReadonlySet<TripStatus> = new Set(['published', 'confirmed', 'in_progress']);

// Mis viajes. Como conductor: sus viajes, primero los próximos (con sus
// solicitudes para aceptarlas o rechazarlas) y después los anteriores. Como
// pasajero, sus solicitudes, cada una con su viaje (PassengerRequests)
@Component({
  selector: 'app-my-trips',
  imports: [
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonRouterLink,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    DriverTripCard,
    PassengerRequests,
  ],
  templateUrl: './my-trips.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './my-trips.page.scss'],
})
export class MyTripsPage {
  private readonly driver = inject(DriverService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly auth = inject(AuthService);

  // Con perfil de conductor, un segmento elige qué se ve; empieza por el
  // último lado usado (activeMode). Sin él, sus solicitudes
  readonly canDrive = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('driver');
  });
  readonly view = linkedSignal<TravelMode>(() =>
    this.activeMode.mode() === 'driver' && this.canDrive() ? 'driver' : 'passenger',
  );
  readonly isDriver = computed(() => this.view() === 'driver');

  readonly trips = resource({
    params: () => (this.isDriver() ? true : undefined),
    loader: () => this.driver.listMyTrips(),
  });
  private readonly allTrips = computed<readonly DriverTrip[]>(() =>
    this.trips.hasValue() ? this.trips.value() : [],
  );
  readonly upcoming = computed(() => this.allTrips().filter(({ status }) => UPCOMING.has(status)));
  // Los anteriores, del más reciente al más antiguo
  readonly past = computed(() =>
    this.allTrips()
      .filter(({ status }) => !UPCOMING.has(status))
      .reverse(),
  );

  protected readonly emptyIcon = carOutline;
  protected readonly errorIcon = alertCircleOutline;

  // Al decidir una solicitud cambian las plazas (y quizá el estado)
  // El segmento da su valor sin tipo
  handleViewChange(value: string | number | undefined): void {
    if (value === 'passenger' || value === 'driver') {
      this.view.set(value);
    }
  }

  handleChanged(): void {
    this.trips.reload();
  }
}
