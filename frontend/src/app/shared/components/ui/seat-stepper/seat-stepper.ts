import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addOutline, removeOutline } from 'ionicons/icons';

// Contador de plazas (SeatStepper de la guía): «−», el número y «+», entre un
// mínimo y un máximo. Es un fieldset con la etiqueta como leyenda; el número
// se anuncia al cambiar. Se usa como cualquier campo (formControlName)
@Component({
  selector: 'app-seat-stepper',
  imports: [IonIcon],
  templateUrl: './seat-stepper.html',
  styleUrl: './seat-stepper.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SeatStepper), multi: true },
  ],
})
export class SeatStepper implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly min = input(1);
  readonly max = input(4);
  // Texto opcional debajo (p. ej. «Tu coche tiene 3 plazas libres»)
  readonly hint = input<string>();

  readonly value = signal(1);
  readonly isDisabled = signal(false);
  readonly canRemove = computed(() => !this.isDisabled() && this.value() > this.min());
  readonly canAdd = computed(() => !this.isDisabled() && this.value() < this.max());

  protected readonly removeIcon = removeOutline;
  protected readonly addIcon = addOutline;

  private onChange: (value: number) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  change(delta: number): void {
    const next = Math.min(this.max(), Math.max(this.min(), this.value() + delta));
    if (next === this.value()) {
      return;
    }
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }

  writeValue(value: number | string | null): void {
    const seats = Number(value);
    this.value.set(Number.isFinite(seats) && seats > 0 ? seats : this.min());
  }

  registerOnChange(onChange: (value: number) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
