import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';
import { scrollBehavior } from '../utils/motion.util';

// Lo que avanza cada flecha: casi lo que se ve, para no perder el hilo
const SCROLL_STEP_RATIO = 0.8;

// En una fila que se desliza a los lados, si queda contenido oculto a la
// izquierda o a la derecha (para enseñar una flecha a ese lado) y avanzar con
// ella. Se recalcula al deslizar y cuando cambia el ancho de la fila o de lo
// que tiene dentro (al girar el móvil o al cargarse una imagen)
@Directive({
  selector: '[appScrollEdges]',
  exportAs: 'scrollEdges',
  host: { '(scroll)': 'update()' },
})
export class ScrollEdges {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;

  readonly canScrollBack = signal(false);
  readonly canScrollForward = signal(false);

  constructor() {
    const observer = new ResizeObserver(() => this.update());
    afterNextRender(() => {
      for (const target of [this.element, ...Array.from(this.element.children)]) {
        observer.observe(target);
      }
      // La primera vez, sin esperar al observador (no avisa si el navegador
      // aún no ha pintado, p. ej. con la pestaña en segundo plano)
      this.update();
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  // 1 px de margen por los redondeos del navegador
  update(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this.element;
    this.canScrollBack.set(scrollLeft > 1);
    this.canScrollForward.set(scrollLeft + clientWidth < scrollWidth - 1);
  }

  scrollStep(direction: -1 | 1): void {
    this.element.scrollBy({
      left: direction * this.element.clientWidth * SCROLL_STEP_RATIO,
      behavior: scrollBehavior(),
    });
  }
}
