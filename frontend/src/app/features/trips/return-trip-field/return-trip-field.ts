import { Component, computed, effect, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonCheckbox } from '@ionic/angular';
import { merge } from 'rxjs';
import { DatetimeField } from '../../../shared/components/ui/datetime-field/datetime-field';
import { isReturnBeforeArrival } from './return-trip';

export interface ReturnTripControls {
  hasReturn: FormControl<boolean>;
  returnTime: FormControl<string>;
}

// «Publicar también la vuelta» (docs/diseno-modos-recogida-y-vuelta.md, §4.6):
// al ir al campus, una casilla y, marcada, la hora de salida de la vuelta (el
// mismo día). Sus plazas se eligen con las de la ida, en el paso Vehículo
@Component({
  selector: 'app-return-trip-field',
  imports: [ReactiveFormsModule, IonCheckbox, DatetimeField],
  templateUrl: './return-trip-field.html',
  styleUrl: './return-trip-field.scss',
})
export class ReturnTripField {
  readonly controls = input.required<ReturnTripControls>();
  // La llegada al campus de la ida («HH:MM»)
  readonly arrivalTime = input.required<string>();

  readonly hasReturn = signal(false);
  readonly returnTime = signal('');
  readonly isTooEarly = computed(
    () => this.hasReturn() && isReturnBeforeArrival(this.arrivalTime(), this.returnTime()),
  );

  constructor() {
    effect((onCleanup) => {
      const { hasReturn, returnTime } = this.controls();
      const sync = (): void => {
        this.hasReturn.set(hasReturn.value);
        this.returnTime.set(returnTime.value);
      };
      sync();
      const subscription = merge(hasReturn.valueChanges, returnTime.valueChanges).subscribe(sync);
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
