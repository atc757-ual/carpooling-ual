import { Component, computed, inject, input, resource } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonContent, IonSpinner } from '@ionic/angular';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { DriverTripCard } from '../driver-trip-card/driver-trip-card';

// El detalle de un viaje publicado: la tarjeta completa con sus solicitudes,
// el chat, «Iniciar viaje» y «Cancelar viaje». La lista de Mis viajes solo
// muestra el resumen
@Component({
  selector: 'app-driver-trip-detail',
  imports: [IonButton, IonCard, IonCardContent, IonContent, IonSpinner, DriverTripCard],
  templateUrl: './driver-trip-detail.page.html',
  styleUrl: '../../tabs/tab-page.scss',
})
export class DriverTripDetailPage {
  private readonly driver = inject(DriverService);

  readonly id = input.required<string>();

  readonly trips = resource({
    params: () => this.id(),
    loader: () => this.driver.listMyTrips(),
  });
  readonly trip = computed(() =>
    this.trips.hasValue() ? (this.trips.value().find(({ id }) => id === this.id()) ?? null) : null,
  );

  handleReload(): void {
    this.trips.reload();
  }
}
