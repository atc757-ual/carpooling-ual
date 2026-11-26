import { afterNextRender, DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';
import { scrollBehavior } from '../utils/motion.util';

// Lo que baja la píldora: casi lo que se ve, para no perder el hilo
const SCROLL_STEP_RATIO = 0.8;
// Margen para no invitar a bajar por unos píxeles
const BOTTOM_MARGIN = 16; // px

// En el cuerpo de una ventana que se desplaza (.modal-body), si queda
// contenido por debajo (para enseñar «Desliza para ver más», app-scroll-hint)
// y bajar con ella. Se recalcula al desplazar, cuando cambia el alto de la
// ventana (al abrirse con su animación, al girar el móvil) y cuando cambia lo
// que tiene dentro (al llegar más filas)
@Directive({
  selector: '[appScrollHint]',
  exportAs: 'scrollHint',
  host: { '(scroll)': 'update()' },
})
export class ScrollHint {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;

  readonly canScrollDown = signal(false);

  constructor() {
    // Sin ResizeObserver (navegadores antiguos), solo al desplazar y al cambiar
    // el contenido
    const resizes =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.update());
    const changes = new MutationObserver(() => this.update());
    afterNextRender(() => {
      resizes?.observe(this.element);
      changes.observe(this.element, { childList: true, subtree: true });
      // La primera vez, sin esperar a los observadores
      this.update();
    });
    inject(DestroyRef).onDestroy(() => {
      resizes?.disconnect();
      changes.disconnect();
    });
  }

  update(): void {
    const { scrollTop, scrollHeight, clientHeight } = this.element;
    this.canScrollDown.set(scrollHeight - scrollTop - clientHeight > BOTTOM_MARGIN);
  }

  scrollDown(): void {
    this.element.scrollBy({
      top: this.element.clientHeight * SCROLL_STEP_RATIO,
      behavior: scrollBehavior(),
    });
  }
}
