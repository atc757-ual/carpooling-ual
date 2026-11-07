import { Injectable, signal } from '@angular/core';

// Lo que hay que bajar o subir de una vez para que cambie (los toques cortos
// no la mueven) y la zona de arriba donde siempre se ve
export const COLLAPSE_THRESHOLD_PX = 12;
export const ALWAYS_VISIBLE_TOP_PX = 56;

// La franja del título de las secciones en el móvil: se esconde al bajar por
// una lista y vuelve al subir o al llegar arriba. Las pantallas la avisan con
// CollapsingHeadingDirective; las pestañas la muestran de nuevo al navegar
@Injectable({ providedIn: 'root' })
export class CollapsingHeadingService {
  private readonly hiddenState = signal(false);
  readonly isHidden = this.hiddenState.asReadonly();
  // Desde dónde se mide el último movimiento
  private anchorTop = 0;

  track(scrollTop: number): void {
    if (scrollTop <= ALWAYS_VISIBLE_TOP_PX) {
      this.hiddenState.set(false);
      this.anchorTop = scrollTop;
      return;
    }
    const delta = scrollTop - this.anchorTop;
    if (Math.abs(delta) < COLLAPSE_THRESHOLD_PX) {
      return;
    }
    this.hiddenState.set(delta > 0);
    this.anchorTop = scrollTop;
  }

  reset(): void {
    this.hiddenState.set(false);
    this.anchorTop = 0;
  }
}
