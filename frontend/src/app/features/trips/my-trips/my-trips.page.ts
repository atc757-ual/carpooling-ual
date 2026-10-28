import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonRouterLink,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, carOutline, mapOutline } from 'ionicons/icons';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { DriverTripCard } from '../driver-trip-card/driver-trip-card';

// Viajes que aún no han terminado
const UPCOMING: readonly TripStatus[] = ['published', 'confirmed', 'in_progress'];

// Mis viajes. Como conductor: sus viajes, primero los próximos (con sus
// solicitudes para aceptarlas o rechazarlas) y después los anteriores. Como
// pasajero, sus solicitudes llegan en el siguiente paso
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
    IonSpinner,
    DriverTripCard,
  ],
  templateUrl: './my-trips.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './my-trips.page.scss'],
})
export class MyTripsPage {
  private readonly driver = inject(DriverService);
  private readonly activeMode = inject(ActiveModeService);

  readonly isDriver = computed(() => this.activeMode.mode() === 'driver');

  readonly trips = resource({
    params: () => (this.isDriver() ? true : undefined),
    loader: () => this.driver.listMyTrips(),
  });
  private readonly allTrips = computed<readonly DriverTrip[]>(() =>
    this.trips.hasValue() ? this.trips.value() : [],
  );
  readonly upcoming = computed(() =>
    this.allTrips().filter(({ status }) => UPCOMING.includes(status)),
  );
  // Los anteriores, del más reciente al más antiguo
  readonly past = computed(() =>
    this.allTrips()
      .filter(({ status }) => !UPCOMING.includes(status))
      .reverse(),
  );

  protected readonly emptyIcon = carOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly passengerIcon = mapOutline;

  // Al decidir una solicitud cambian las plazas (y quizá el estado)
  handleChanged(): void {
    this.trips.reload();
  }
}
