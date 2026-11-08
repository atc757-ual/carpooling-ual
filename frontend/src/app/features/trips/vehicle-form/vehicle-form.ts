import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
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
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { DeclarationContent } from '../declaration-content/declaration-content';
import { DeclarationField } from '../declaration-field/declaration-field';
import { SeatStepper } from '../../../shared/components/ui/seat-stepper/seat-stepper';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
import { BrandField } from '../../../shared/components/ui/brand-field/brand-field';
import { LicensePlate } from '../../../shared/components/ui/license-plate/license-plate';
import { PlateCountrySelect } from '../../../shared/components/ui/plate-country-select/plate-country-select';
import { formatPlate, vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';
import { VehicleColorsStore } from '../../../core/services/catalogs/vehicle-colors.store';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  DEFAULT_PLATE_COUNTRY,
  isValidPlate,
  normalizePlate,
  plateSign,
} from '../../../shared/utils/plate-country.util';

// La matrícula, con el formato de su país (el del campo «País de la matrícula»)
const plateOfCountryValidator: ValidatorFn = (control: AbstractControl) => {
  const country = control.parent?.get('plateCountry')?.value ?? DEFAULT_PLATE_COUNTRY;
  const plate = String(control.value ?? '');
  return plate === '' || isValidPlate(plate, country) ? null : { plate: true };
};
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
    DeclarationContent,
    DeclarationField,
    PlateCountrySelect,
  ],
  templateUrl: './vehicle-form.html',
  styleUrl: './vehicle-form.scss',
})
export class VehicleForm {
  private readonly driver = inject(DriverService);
  private readonly toast = inject(ToastService);
  private readonly legalDocuments = inject(LegalDocumentsService);

  // El vehículo a editar; sin él, se registra uno nuevo
  readonly vehicle = input<Vehicle | null>(null);
  readonly submitLabel = input('Guardar vehículo');
  readonly saved = output<Vehicle>();
  // Al editar: el nombre y la matrícula, de solo lectura (null al registrar)
  readonly summary = computed(() => {
    const vehicle = this.vehicle();
    return vehicle
      ? {
          name: vehicleDisplayName(vehicle),
          plate: formatPlate(vehicle.plate),
          sign: plateSign(vehicle.plateCountry),
        }
      : null;
  });

  readonly isSaving = signal(false);
  // Leyendo la declaración del vehículo, dentro de esta misma ventana
  readonly isReadingDeclaration = signal(false);
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
    plateCountry: [DEFAULT_PLATE_COUNTRY],
    plate: ['', [Validators.required, plateOfCountryValidator]],
    totalSeats: [DEFAULT_TOTAL_SEATS],
    color: ['', Validators.required],
    engine: ['', Validators.required],
    // Al registrarlo: su declaración (seguro e ITV), que queda unida a él
    declared: [false, Validators.requiredTrue],
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
  // España: su formato; el resto: letras y números, como en la placa
  private readonly plateCountry = toSignal(this.form.controls.plateCountry.valueChanges, {
    initialValue: this.form.controls.plateCountry.value,
  });
  readonly isSpanishPlate = computed(() => this.plateCountry() === DEFAULT_PLATE_COUNTRY);
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
      this.form.controls.plateCountry.enable();
      this.form.setValue({
        brand: vehicle.brand ?? '',
        model: vehicle.model ?? '',
        plateCountry: vehicle.plateCountry,
        plate: vehicle.plate,
        totalSeats: vehicle.capacity + 1,
        color: vehicle.color ?? '',
        engine: vehicle.engine ?? '',
        declared: true,
      });
      this.form.controls.declared.disable();
      this.form.controls.brand.disable();
      this.form.controls.model.disable();
      this.form.controls.plate.disable();
      this.form.controls.plateCountry.disable();
    });
    // Al cambiar de país, la matrícula se vuelve a comprobar con su formato
    this.form.controls.plateCountry.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.plate.updateValueAndValidity());
  }

  // «Acepto la declaración»: marca la casilla y vuelve al formulario
  handleDeclarationAccepted(): void {
    this.form.controls.declared.setValue(true);
    this.isReadingDeclaration.set(false);
  }

  async handleSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { brand, model, plate, plateCountry, totalSeats, color, engine } =
      this.form.getRawValue();
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
            declarationVersion: (await this.legalDocuments.getCurrent('vehicle_declaration'))
              .version,
            brand: brand.trim(),
            model: model.trim(),
            color,
            engine: engine as VehicleEngine,
            capacity,
            plate: normalizePlate(plate),
            plateCountry,
          });
      this.saved.emit(saved);
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSaving.set(false);
    }
  }
}
