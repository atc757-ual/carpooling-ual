import { DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

// Lo que tarda en volver a su forma si no se toca otra vez
const REVEAL_MS = 4000;

// Un botón de icono que muestra su texto (.icon-btn--reveal, del tema): con
// ratón, al pasar por encima; en pantallas táctiles, el primer toque solo lo
// estira con el texto y el segundo hace lo suyo (llamar, compartir…). Escucha
// en captura para ganar al (click) del botón y al enlace (tel:)
@Directive({
  selector: '[appRevealOnTouch]',
  host: { '[class.icon-btn--revealed]': 'isRevealed()' },
})
export class RevealOnTouch {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  readonly isRevealed = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const handleClick = (event: Event): void => {
      const isTouch = globalThis.matchMedia?.('(any-hover: none)').matches ?? false;
      if (!isTouch || this.isRevealed()) {
        this.collapse();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      this.isRevealed.set(true);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.collapse(), REVEAL_MS);
    };
    this.element.addEventListener('click', handleClick, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      this.element.removeEventListener('click', handleClick, { capture: true });
      clearTimeout(this.timer);
    });
  }

  private collapse(): void {
    clearTimeout(this.timer);
    this.isRevealed.set(false);
  }
}
