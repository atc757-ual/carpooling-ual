import { Component, computed, inject, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import {
  carOutline,
  checkmarkCircle,
  createOutline,
  ellipseOutline,
  trashOutline,
} from 'ionicons/icons';
import { LicensePlate } from '../license-plate/license-plate';
import { Vehicle } from '../../../../core/models/driver.model';
import { VehicleColorsStore } from '../../../../core/services/catalogs/vehicle-colors.store';
import { formatPlate, vehicleDisplayName, vehicleSpecs } from '../../../utils/vehicle-display.util';

// Un vehículo en una tarjeta: «Seat Ibiza | 1234 BGG» y debajo «● Gris ·
// 4 plazas · Híbrido». Se elige pulsándola (un radio nativo, oculto, del
// grupo groupName) y, con hasActions, a la derecha el lápiz y la papelera. En
// Publicar elige el vehículo del viaje; en el Perfil, el predeterminado
@Component({
  selector: 'app-vehicle-card',
  imports: [IonIcon, LicensePlate],
  templateUrl: './vehicle-card.html',
  styleUrl: './vehicle-card.scss',
})
export class VehicleCard {
  readonly vehicle = input.required<Vehicle>();
  readonly groupName = input.required<string>();
  readonly isSelected = input(false);
  readonly hasActions = input(false);
  // El coche a la izquierda (en Publicar; en Mi perfil, sin él)
  readonly hasIcon = input(true);

  readonly selected = output<Vehicle>();
  readonly edit = output<Vehicle>();
  readonly remove = output<Vehicle>();

  readonly name = computed(() => vehicleDisplayName(this.vehicle()));
  readonly plate = computed(() => formatPlate(this.vehicle().plate));
  private readonly colors = inject(VehicleColorsStore);
  readonly specs = computed(() =>
    vehicleSpecs(this.vehicle(), this.colors.label(this.vehicle().color)),
  );
  readonly swatch = computed(() => this.colors.swatch(this.vehicle().color));

  protected readonly icons = {
    car: carOutline,
    checked: checkmarkCircle,
    unchecked: ellipseOutline,
    edit: createOutline,
    remove: trashOutline,
  };
}
