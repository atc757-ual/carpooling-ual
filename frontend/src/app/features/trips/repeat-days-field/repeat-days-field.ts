import { Component, computed, effect, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IonCheckbox } from '@ionic/angular';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { merge } from 'rxjs';
import { DatetimeField } from '../../../shared/components/ui/datetime-field/datetime-field';
import { WeekdayPicker } from '../../../shared/components/ui/weekday-picker/weekday-picker';
import { toIsoDate } from '../../../shared/utils/date.util';
import { addDays, weekdayOf } from '../../../shared/utils/weekdays.util';
import { defaultRepeatUntil, latestRepeatDate, repeatDatesFor } from './repeat-days';
import { localizedComputed } from '../../../core/i18n/localized-computed';

export interface RepeatDaysControls {
  isRepeating: FormControl<boolean>;
  weekdays: FormControl<number[]>;
  until: FormControl<string>;
}

// Cuántos viajes salen en total: este, los otros días y, si la hay, la vuelta
// de cada uno
export function repeatSummary(dateCount: number, hasReturn: boolean): string {
  const trips = (dateCount + 1) * (hasReturn ? 2 : 1);
  return translate(hasReturn ? 'publish.repeat.summaryWithReturn' : 'publish.repeat.summary', {
    count: trips,
    days: dateCount + 1,
  });
}

// «Repetir otros días» (viajes recurrentes): una casilla y, marcada, los días
// de la semana y hasta cuándo. Cada día es un viaje independiente, a la misma
// hora; el resumen dice cuántos se publicarán
@Component({
  selector: 'app-repeat-days-field',
  imports: [ReactiveFormsModule, IonCheckbox, DatetimeField, TranslocoPipe, WeekdayPicker],
  templateUrl: './repeat-days-field.html',
  styleUrl: './repeat-days-field.scss',
})
export class RepeatDaysField {
  readonly controls = input.required<RepeatDaysControls>();
  // El día del viaje («AAAA-MM-DD») y si lleva vuelta
  readonly firstDate = input.required<string>();
  readonly hasReturn = input(false);

  readonly isRepeating = signal(false);
  readonly chosen = signal<readonly number[]>([]);
  readonly until = signal('');
  readonly minUntil = computed(() => addDays(this.firstDate(), 1));
  readonly maxUntil = latestRepeatDate(toIsoDate(new Date()));
  readonly dates = computed(() => repeatDatesFor(this.firstDate(), this.chosen(), this.until()));
  readonly summary = localizedComputed(() =>
    this.dates().length > 0 ? repeatSummary(this.dates().length, this.hasReturn()) : null,
  );

  constructor() {
    effect((onCleanup) => {
      const { isRepeating, weekdays, until } = this.controls();
      const sync = (): void => {
        this.isRepeating.set(isRepeating.value);
        this.chosen.set(weekdays.value);
        this.until.set(until.value);
      };
      sync();
      const subscription = merge(
        isRepeating.valueChanges,
        weekdays.valueChanges,
        until.valueChanges,
      ).subscribe(sync);
      onCleanup(() => subscription.unsubscribe());
    });
  }

  // Al marcarla, propone el mismo día de la semana del viaje y 4 semanas
  handleRepeat(isChecked: boolean): void {
    const { weekdays, until } = this.controls();
    if (!isChecked) {
      return;
    }
    if (weekdays.value.length === 0) {
      weekdays.setValue([weekdayOf(this.firstDate())]);
    }
    if (until.value === '') {
      until.setValue(defaultRepeatUntil(this.firstDate(), toIsoDate(new Date())));
    }
  }
}
