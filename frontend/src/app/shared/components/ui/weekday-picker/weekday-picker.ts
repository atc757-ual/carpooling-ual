import { Component, input, output } from '@angular/core';
import { IonCheckbox } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { WEEKDAYS } from '../../../utils/weekdays.util';

// Los días de la semana como siete casillas en una fila, con su letra (L M X
// J V S D) encima; el lector de pantalla lee el nombre entero. En un fieldset
// con su leyenda. value: los elegidos, de 1 (lunes) a 7 (domingo), en orden
@Component({
  selector: 'app-weekday-picker',
  imports: [IonCheckbox, TranslocoPipe],
  template: `
    <fieldset class="weekday-picker">
      <legend class="text-label">{{ legend() }}</legend>
      @for (day of weekdays; track day) {
        <ion-checkbox
          class="weekday-picker__day"
          labelPlacement="stacked"
          alignment="center"
          [checked]="value().includes(day)"
          (ionChange)="handleDay(day, $event.detail.checked)"
        >
          <span aria-hidden="true">{{ 'common.weekdays.short.' + day | transloco }}</span>
          <span class="visually-hidden">{{ 'common.weekdays.long.' + day | transloco }}</span>
        </ion-checkbox>
      }
    </fieldset>
  `,
  styles: `
    // Los siete en una fila (se parte si no caben)
    .weekday-picker {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
      margin: 0;
      padding: 0;
      border: 0;

      legend {
        width: 100%;
        margin-bottom: var(--space-xs);
        padding: 0;
      }
    }

    .weekday-picker__day {
      min-width: var(--control-height-base); // 48px, el mínimo para tocar
    }
  `,
})
export class WeekdayPicker {
  readonly legend = input.required<string>();
  readonly value = input.required<readonly number[]>();
  readonly valueChange = output<number[]>();

  protected readonly weekdays = WEEKDAYS;

  handleDay(day: number, isChecked: boolean): void {
    const others = this.value().filter((chosen) => chosen !== day);
    this.valueChange.emit(isChecked ? [...others, day].sort((a, b) => a - b) : others);
  }
}
