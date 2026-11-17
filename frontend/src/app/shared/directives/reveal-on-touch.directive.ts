import { DestroyRef, Directive, ElementRef, inject, signal } from '@angular/core';

// Lo que tarda en volver a su forma si no se toca otra vez
const REVEAL_MS = 4000;

// Un botón de icono que muestra su texto (.icon-btn--reveal, del tema): con
// ratón, al pasar por encima; con el dedo (o un lápiz), el primer toque solo lo
// estira con el texto y el segundo hace lo suyo (llamar, compartir…). Se mira
// con qué se ha tocado (pointerType) y no si la pantalla tiene hover: muchos
// móviles Android dicen que sí. Escucha en captura para ganar al (click) del
// botón y al enlace (tel:). Con el teclado, actúa a la primera (el texto ya se
// ve al enfocarlo)
@Directive({
  selector: '[appRevealOnTouch]',
  host: { '[class.icon-btn--revealed]': 'isRevealed()' },
})
export class RevealOnTouch {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  readonly isRevealed = signal(false);
  private pointerType = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const handlePointerDown = (event: PointerEvent): void => {
      this.pointerType = event.pointerType;
    };
    const handleClick = (event: Event): void => {
      const isTouch = this.pointerType === 'touch' || this.pointerType === 'pen';
      this.pointerType = '';
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
    this.element.addEventListener('pointerdown', handlePointerDown, { capture: true });
    this.element.addEventListener('click', handleClick, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      this.element.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      this.element.removeEventListener('click', handleClick, { capture: true });
      clearTimeout(this.timer);
    });
  }

  private collapse(): void {
    clearTimeout(this.timer);
    this.isRevealed.set(false);
  }
}
