import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonInput, IonSpinner } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { Vehicle } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { SeatStepper } from '../../../shared/components/ui/seat-stepper/seat-stepper';
import { IonicFormStatus } from '../../../shared/directives/ionic-form-status.directive';
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
  imports: [ReactiveFormsModule, IonButton, IonInput, IonSpinner, IonicFormStatus, SeatStepper],
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

  readonly isSaving = signal(false);

  readonly form = inject(NonNullableFormBuilder).group({
    // La API guarda las dos juntas («Seat Ibiza», hasta 60 caracteres)
    brand: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(29)]],
    model: ['', [Validators.required, Validators.maxLength(30)]],
    plate: ['', [Validators.required, Validators.pattern(PLATE_PATTERN)]],
    totalSeats: [DEFAULT_TOTAL_SEATS],
  });

  // Con todos los campos bien (la matrícula, al editar, no cuenta: no se cambia)
  private readonly status = toSignal(this.form.statusChanges, { initialValue: this.form.status });
  readonly isComplete = computed(() => this.status() === 'VALID');

  private readonly totalSeats = toSignal(this.form.controls.totalSeats.valueChanges, {
    initialValue: DEFAULT_TOTAL_SEATS,
  });
  // «5 asientos = 1 conductor + hasta 4 pasajeros»
  readonly seatsNotice = computed(() => {
    const total = this.totalSeats();
    const passengers = total - 1;
    return `${total} asientos = 1 conductor + hasta ${passengers} ${passengers === 1 ? 'pasajero' : 'pasajeros'}`;
  });

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
      // «Seat Ibiza»: la marca hasta el primer espacio y el resto, el modelo
      const [brand = '', ...model] = (vehicle.model ?? '').split(' ');
      this.form.setValue({
        brand,
        model: model.join(' '),
        plate: vehicle.plate,
        totalSeats: vehicle.capacity + 1,
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
    const { brand, model, plate, totalSeats } = this.form.getRawValue();
    const capacity = totalSeats - 1;
    const vehicle = this.vehicle();
    this.isSaving.set(true);
    try {
      // Al editar solo cambian los asientos
      const saved = vehicle
        ? await this.driver.updateVehicle(vehicle.id, { capacity })
        : await this.driver.registerVehicle({
            model: `${brand.trim()} ${model.trim()}`,
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
