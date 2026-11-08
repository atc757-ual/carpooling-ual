import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonChip } from '@ionic/angular';

// Color del punto que acompaña a la opción (el de su etiqueta en la lista)
export type FilterChipTone = 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface FilterChipOption {
  value: string;
  label: string;
  tone?: FilterChipTone;
}

// Un filtro del panel como un grupo de chips (fieldset con su leyenda): una
// opción para quitarlo («Todos») y una por valor; la elegida, en azul y con
// aria-pressed. Avisa del valor elegido (null para «Todos»)
@Component({
  selector: 'app-filter-chips',
  imports: [IonChip],
  templateUrl: './filter-chips.html',
  styleUrl: './filter-chips.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterChips {
  readonly legend = input.required<string>();
  readonly options = input.required<readonly FilterChipOption[]>();
  readonly value = input<string | null | undefined>(null);
  // Texto de la opción sin filtro; null para no ofrecerla (p. ej. si el filtro
  // siempre tiene un valor)
  readonly allLabel = input<string | null>('Todos');
  readonly valueChange = output<string | null>();
}
