import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { carOutline } from 'ionicons/icons';
import { VehicleColor } from '../../../core/models/driver.model';
import { TripDriver } from '../../../core/models/trip-result.model';
import { RouteStop, RouteTimeline } from './route-timeline/route-timeline';
import { TripDriver as TripDriverComponent } from '../../../features/matching/trip-driver/trip-driver';
import {
  vehicleColorLabel,
  vehicleColorSwatch,
  vehicleDisplayName,
} from '../../utils/vehicle-display.util';

export interface TripSummaryData {
  stops: readonly RouteStop[];
  driver: TripDriver;
  vehicle: { brand: string | null; model: string | null; color: VehicleColor | null } | null;
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
  protected readonly vehicleColor = (color: VehicleColor | null) => vehicleColorLabel(color);
  protected readonly vehicleSwatch = (color: VehicleColor | null) => vehicleColorSwatch(color);
}
