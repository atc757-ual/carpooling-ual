import { Component, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { carOutline } from 'ionicons/icons';
import { VehicleColorsStore } from '../../../core/services/catalogs/vehicle-colors.store';
import { TripDriver } from '../../../core/models/trip-result.model';
import { RouteStop, RouteTimeline } from './route-timeline/route-timeline';
import { TripDriver as TripDriverComponent } from '../../../features/matching/trip-driver/trip-driver';
import { vehicleDisplayName } from '../../utils/vehicle-display.util';

export interface TripSummaryData {
  stops: readonly RouteStop[];
  driver: TripDriver;
  vehicle: { brand: string | null; model: string | null; color: string | null } | null;
  seatSummary: string;
  vehiclePlate: string | null;
  facts?: string;
  preferences?: readonly string[];
}

// Resumen sin mapa: mismo recorrido, conductor y coche en el detalle y en la
// solicitud del pasajero.
@Component({
  selector: 'app-trip-summary',
  imports: [IonIcon, RouteTimeline, TripDriverComponent],
  templateUrl: './trip-summary.html',
  styleUrl: './trip-summary.scss',
})
export class TripSummary {
  readonly summary = input.required<TripSummaryData>();
  protected readonly carIcon = carOutline;
  protected readonly vehicleName = vehicleDisplayName;
  private readonly colors = inject(VehicleColorsStore);
  protected readonly vehicleColor = (color: string | null) => this.colors.label(color);
  protected readonly vehicleSwatch = (color: string | null) => this.colors.swatch(color);
}
