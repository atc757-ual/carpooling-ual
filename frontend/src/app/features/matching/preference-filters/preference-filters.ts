import { TranslocoPipe } from '@jsverse/transloco';
import { Component, input, output, signal } from '@angular/core';
import { IonButton, IonCheckbox, IonIcon, IonItem, IonList, IonModal } from '@ionic/angular';
import {
  chatbubblesOutline,
  leafOutline,
  musicalNotesOutline,
  optionsOutline,
  pawOutline,
  volumeMuteOutline,
} from 'ionicons/icons';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { PreferenceFilter } from './preference-filter';

const OPTIONS: readonly { value: PreferenceFilter; label: string; icon: string }[] = [
  { value: 'no_smoking', label: 'searchFilters.no_smoking', icon: leafOutline },
  { value: 'pets', label: 'searchFilters.pets', icon: pawOutline },
  { value: 'music', label: 'searchFilters.music', icon: musicalNotesOutline },
  { value: 'chatty', label: 'searchFilters.chatty', icon: chatbubblesOutline },
  { value: 'quiet', label: 'searchFilters.quiet', icon: volumeMuteOutline },
];

// Filtros por las preferencias del conductor (las pastillas ocupaban
// mucho): un botón «Filtros» con cuántos hay elegidos,
// junto a «Ordenar por», que abre una hoja en el móvil y una ventana en
// escritorio (info-dialog) con una casilla por preferencia. Cada casilla
// filtra al momento; «Ver N viajes» cierra y «Quitar filtros» los quita todos
@Component({
  selector: 'app-preference-filters',
  imports: [
    IonButton,
    IonCheckbox,
    IonIcon,
    IonItem,
    IonList,
    IonModal,
    ModalHeader,
    TranslocoPipe,
  ],
  templateUrl: './preference-filters.html',
  styleUrl: './preference-filters.scss',
})
export class PreferenceFilters {
  readonly selected = input.required<ReadonlySet<PreferenceFilter>>();
  // Cuántos viajes pasan los filtros elegidos
  readonly resultCount = input.required<number>();
  readonly toggled = output<PreferenceFilter>();
  readonly cleared = output<void>();

  readonly isOpen = signal(false);
  protected readonly options = OPTIONS;
  protected readonly filtersIcon = optionsOutline;
}
