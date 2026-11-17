import { Component, input, output } from '@angular/core';
import { IonChip, IonIcon } from '@ionic/angular';
import {
  chatbubblesOutline,
  leafOutline,
  musicalNotesOutline,
  pawOutline,
  volumeMuteOutline,
} from 'ionicons/icons';
import { PreferenceFilter } from './preference-filter';

const OPTIONS: readonly { value: PreferenceFilter; label: string; icon: string }[] = [
  { value: 'no_smoking', label: 'Sin humo', icon: leafOutline },
  { value: 'pets', label: 'Admite mascotas', icon: pawOutline },
  { value: 'music', label: 'Con música', icon: musicalNotesOutline },
  { value: 'chatty', label: 'Con charla', icon: chatbubblesOutline },
  { value: 'quiet', label: 'Tranquilo', icon: volumeMuteOutline },
];

// Filtros por las preferencias del conductor, en chips con su icono como los
// filtros de la guía (app-filter-chips), pero de elección múltiple: cada uno
// se activa o se quita por separado (aria-pressed). Avisa del que se pulsa
@Component({
  selector: 'app-preference-filters',
  imports: [IonChip, IonIcon],
  template: `
    <fieldset class="preference-filters">
      <legend class="visually-hidden">Filtrar por preferencias del conductor</legend>
      @for (option of options; track option.value) {
        <ion-chip
          button="true"
          [class.preference-filters__chip--selected]="selected().has(option.value)"
          [attr.aria-pressed]="selected().has(option.value)"
          (click)="toggled.emit(option.value)"
        >
          <ion-icon [icon]="option.icon" aria-hidden="true" />
          {{ option.label }}
        </ion-chip>
      }
    </fieldset>
  `,
  styleUrl: './preference-filters.scss',
})
export class PreferenceFilters {
  readonly selected = input.required<ReadonlySet<PreferenceFilter>>();
  readonly toggled = output<PreferenceFilter>();

  protected readonly options = OPTIONS;
}
