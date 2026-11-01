import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular';

// Separador de miles con espacio que no se parte (1 284), también con cuatro
// cifras (Intl en español no separa los números de cuatro cifras)
export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

// Paginación de las listas del panel (TMF630: offset y limit, con el total de
// X-Total-Count): «1–20 de 1 284» y «Anterior / Siguiente». Avisa del nuevo
// offset; quien la usa vuelve a pedir la página
@Component({
  selector: 'app-pagination',
  imports: [IonButton],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  readonly offset = input.required<number>();
  readonly limit = input.required<number>();
  readonly total = input.required<number>();
  // Mientras carga una página, los botones no responden
  readonly isLoading = input(false);

  readonly offsetChange = output<number>();

  protected readonly range = computed(() => {
    const total = this.total();
    if (total === 0) {
      return '0 de 0';
    }
    const first = this.offset() + 1;
    const last = Math.min(this.offset() + this.limit(), total);
    return `${formatCount(first)}–${formatCount(last)} de ${formatCount(total)}`;
  });
  protected readonly hasPrevious = computed(() => this.offset() > 0);
  protected readonly hasNext = computed(() => this.offset() + this.limit() < this.total());

  handlePrevious(): void {
    this.offsetChange.emit(Math.max(this.offset() - this.limit(), 0));
  }

  handleNext(): void {
    this.offsetChange.emit(this.offset() + this.limit());
  }
}
