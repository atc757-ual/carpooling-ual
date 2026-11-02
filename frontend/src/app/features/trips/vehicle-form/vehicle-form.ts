import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonIcon, IonInput, IonSpinner } from '@ionic/angular';
import {
  checkmark,
  ellipsisHorizontalCircleOutline,
  flashOutline,
  leafOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { Vehicle, VehicleEngine } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { SeatStepper } from '../../../shared/components/ui/seat-stepper/seat-stepper';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { BrandField } from '../../../shared/components/ui/brand-field/brand-field';
import { LicensePlate } from '../../../shared/components/ui/license-plate/license-plate';
import { formatPlate, vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';
import { VehicleColorsStore } from '../../../core/services/catalogs/vehicle-colors.store';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

// Matrícula española actual (1234BCD; se admiten espacio y guion al escribirla)
const PLATE_PATTERN = /^\d{4}[ -]?[B-DF-HJ-NP-TV-Z]{3}$/i;
// Asientos en total, contando al conductor: de 2 (conductor + 1) a 9; la API
// guarda las plazas para pasajeros (el total menos el conductor)
export const MIN_TOTAL_SEATS = 2;
export const MAX_TOTAL_SEATS = 9;
const DEFAULT_TOTAL_SEATS = 5;

// Datos del vehículo (captura 13 del diseño): marca, modelo, matrícula y
// capacidad total con el conductor incluido, con el aviso de cuántos
// pasajeros caben. Registra uno nuevo o, si recibe un vehículo, lo edita (la
// matrícula no se cambia). Avisa con «saved» al guardar
@Component({
  selector: 'app-vehicle-form',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonInput,
    IonSpinner,
    IonicFormStatus,
    SeatStepper,
    BrandField,
    LicensePlate,
  ],
  templateUrl: './vehicle-form.html',
  styleUrl: './vehicle-form.scss',
})
export class VehicleForm {
  private readonly driver = inject(DriverService);
  private readonly toast = inject(ToastService);

  // El vehículo a editar; sin él, se registra uno nuevo
  readonly vehicle = input<Vehicle | null>(null);
  readonly submitLabel = input('Guardar vehículo');
  readonly saved = output<Vehicle>();
  // Al editar: el nombre y la matrícula, de solo lectura (null al registrar)
  readonly summary = computed(() => {
    const vehicle = this.vehicle();
    return vehicle
      ? { name: vehicleDisplayName(vehicle), plate: formatPlate(vehicle.plate) }
      : null;
  });

  readonly isSaving = signal(false);
  // Los colores activos del catálogo y, al editar, también el del vehículo
  // aunque ya no se ofrezca (lo conserva)
  private readonly colorCatalog = inject(VehicleColorsStore);
  protected readonly colors = computed(() => {
    const offered = this.colorCatalog.offered();
    const current = this.vehicle()?.color ?? null;
    const keys = offered.map(({ key }) => key);
    const shown = current === null || keys.includes(current) ? keys : [...keys, current];
    return shown.map((key) => ({
      value: key,
      label: this.colorCatalog.label(key),
      hex: this.colorCatalog.swatch(key),
    }));
  });
  protected readonly engines: readonly {
    value: VehicleEngine;
    label: string;
    icon: string;
  }[] = [
    { value: 'electric', label: 'Eléctrico', icon: flashOutline },
    { value: 'hybrid', label: 'Híbrido', icon: leafOutline },
    { value: 'other', label: 'Otro', icon: ellipsisHorizontalCircleOutline },
  ];
  readonly form = inject(NonNullableFormBuilder).group({
    brand: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(29)]],
    model: ['', [Validators.required, Validators.maxLength(30)]],
    plate: ['', [Validators.required, Validators.pattern(PLATE_PATTERN)]],
    totalSeats: [DEFAULT_TOTAL_SEATS],
    color: ['', Validators.required],
    engine: ['', Validators.required],
  });

  // Con todos los campos bien (la matrícula, al editar, no cuenta: no se cambia)
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  // El nombre del color elegido, junto a la etiqueta («Color · Azul»)
  private readonly color = toSignal(this.form.controls.color.valueChanges, {
    initialValue: this.form.controls.color.value,
  });
  readonly colorLabel = computed(
    () => this.colors().find(({ value }) => value === this.color())?.label ?? null,
  );
  private readonly engine = toSignal(this.form.controls.engine.valueChanges, {
    initialValue: this.form.controls.engine.value,
  });
  readonly engineLabel = computed(
    () => this.engines.find(({ value }) => value === this.engine())?.label ?? null,
  );
  protected readonly checkIcon = checkmark;
  readonly isComplete = computed(() => this.status() === 'VALID');

  protected readonly minTotalSeats = MIN_TOTAL_SEATS;
  protected readonly maxTotalSeats = MAX_TOTAL_SEATS;

  constructor() {
    // Al editar: sus datos; la marca y el modelo y la matrícula, sin poder
    // cambiarlos (si están mal, se elimina y se registra de nuevo)
    effect(() => {
      const vehicle = this.vehicle();
      if (!vehicle) {
        return;
      }
      this.form.controls.brand.enable();
      this.form.controls.model.enable();
      this.form.controls.plate.enable();
      this.form.setValue({
        brand: vehicle.brand ?? '',
        model: vehicle.model ?? '',
        plate: vehicle.plate,
        totalSeats: vehicle.capacity + 1,
        color: vehicle.color ?? '',
        engine: vehicle.engine ?? '',
      });
      this.form.controls.brand.disable();
      this.form.controls.model.disable();
      this.form.controls.plate.disable();
    });
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { brand, model, plate, totalSeats, color, engine } = this.form.getRawValue();
    const capacity = totalSeats - 1;
    const vehicle = this.vehicle();
    this.isSaving.set(true);
    try {
      const saved = vehicle
        ? await this.driver.updateVehicle(vehicle.id, {
            capacity,
            color,
            engine: engine as VehicleEngine,
          })
        : await this.driver.registerVehicle({
            brand: brand.trim(),
            model: model.trim(),
            color,
            engine: engine as VehicleEngine,
            capacity,
            plate: plate.replaceAll(/[ -]/g, '').toUpperCase(),
          });
      this.saved.emit(saved);
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSaving.set(false);
    }
  }
}
