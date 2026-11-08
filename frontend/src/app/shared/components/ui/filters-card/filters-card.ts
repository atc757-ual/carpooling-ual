import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { IonButton, IonCard, IonChip, IonIcon } from '@ionic/angular';
import { chevronDownOutline, closeOutline, optionsOutline } from 'ionicons/icons';

// Un filtro aplicado, para quitarlo con un toque desde el resumen
export interface ActiveFilter {
  key: string;
  label: string;
}

// Para que cada tarjeta tenga su id (aria-controls de «Más filtros»)
let nextId = 0;

// La tarjeta «Filtros» de las listas del panel: los filtros (app-filter-chips
// u otros campos) van dentro. En escritorio se ven siempre; en el móvil se
// pliegan tras «Más filtros», con el número de aplicados y, cerrado, cada uno
// como un chip que se quita con un toque. «Quitar filtros» con alguno puesto
@Component({
  selector: 'app-filters-card',
  imports: [IonButton, IonCard, IonChip, IonIcon],
  templateUrl: './filters-card.html',
  styleUrl: './filters-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltersCard {
  readonly activeFilters = input<readonly ActiveFilter[]>([]);
  // Si hay algo que quitar (también el buscador, que va fuera de la tarjeta)
  readonly hasFilters = input(false);
  readonly removeFilter = output<string>();
  readonly clearFilters = output();

  readonly isOpen = signal(false);
  protected readonly panelId = `filters-card-${nextId++}`;
  protected readonly filtersIcon = optionsOutline;
  protected readonly toggleIcon = chevronDownOutline;
  protected readonly removeIcon = closeOutline;

  toggle(): void {
    this.isOpen.update((isOpen) => !isOpen);
  }
}
