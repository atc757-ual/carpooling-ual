import { computed, DestroyRef, Directive, ElementRef, inject, input, signal } from '@angular/core';

// Lo que tarda en volver a su forma si no se toca otra vez
const REVEAL_MS = 4000;

// El botón desplegado: uno solo a la vez en toda la app (al desplegar otro,
// el anterior se pliega)
const revealedButton = signal<RevealOnTouch | null>(null);

// Qué hace el botón desplegado (su appRevealHint), para enseñarlo en una línea
// junto a una fila de botones; null si no hay ninguno desplegado o no lo dice
export const revealedHint = computed(() => revealedButton()?.appRevealHint() ?? null);

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
  readonly isRevealed = computed(() => revealedButton() === this);
  // Opcional: qué hace, en una frase (ver revealedHint)
  readonly appRevealHint = input<string | null>(null);
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
      revealedButton.set(this);
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.collapse(), REVEAL_MS);
    };
    this.element.addEventListener('pointerdown', handlePointerDown, { capture: true });
    this.element.addEventListener('click', handleClick, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      this.element.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      this.element.removeEventListener('click', handleClick, { capture: true });
      this.collapse();
    });
  }

  private collapse(): void {
    clearTimeout(this.timer);
    if (revealedButton() === this) {
      revealedButton.set(null);
    }
  }
}
