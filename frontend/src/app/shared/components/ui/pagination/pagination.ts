import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonButton } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { EMPTY } from 'rxjs';

// Separador de miles con espacio que no se parte (1 284), también con cuatro
// cifras (Intl en español no separa los números de cuatro cifras). Se agrupa
// de tres en tres desde la derecha, sin expresiones regulares
export function formatCount(value: number): string {
  const digits = String(value);
  const groups: string[] = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(end - 3, 0), end));
  }
  return groups.join('\u00a0');
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
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  private readonly currentLang = toSignal(this.transloco?.langChanges$ ?? EMPTY);

  readonly offset = input.required<number>();
  readonly limit = input.required<number>();
  readonly total = input.required<number>();
  // Mientras carga una página, los botones no responden
  readonly isLoading = input(false);

  readonly ariaLabel = input<string>();
  readonly previousLabel = input<string>();
  readonly nextLabel = input<string>();

  readonly offsetChange = output<number>();

  protected readonly computedAriaLabel = computed(() => {
    void this.currentLang();
    return this.ariaLabel() ?? this.transloco?.translate('common.pagination.aria') ?? 'Paginación';
  });

  protected readonly computedPreviousLabel = computed(() => {
    void this.currentLang();
    return (
      this.previousLabel() ?? this.transloco?.translate('common.pagination.previous') ?? 'Anterior'
    );
  });

  protected readonly computedNextLabel = computed(() => {
    void this.currentLang();
    return this.nextLabel() ?? this.transloco?.translate('common.pagination.next') ?? 'Siguiente';
  });

  protected readonly range = computed(() => {
    void this.currentLang();
    const total = this.total();
    if (total === 0) {
      return this.transloco?.translate('common.pagination.empty') ?? '0 de 0';
    }
    const first = this.offset() + 1;
    const last = Math.min(this.offset() + this.limit(), total);
    if (this.transloco) {
      return this.transloco.translate('common.pagination.range', {
        start: formatCount(first),
        end: formatCount(last),
        total: formatCount(total),
      });
    }
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
