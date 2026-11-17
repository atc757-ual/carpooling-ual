import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

// Lo que hay que mover el ratón para que cuente como arrastrar (y no como clic)
const DRAG_THRESHOLD_PX = 5;

// Un carrusel con desplazamiento lateral que también se arrastra con el ratón
// (en el móvil ya se desliza con el dedo). Mientras se arrastra se quita el
// encaje (scroll-snap) y, al soltar, el navegador encaja en la tarjeta más
// cercana. Si se ha arrastrado, el clic de después no llega a los botones
@Directive({ selector: '[appDragScroll]' })
export class DragScroll {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private startX = 0;
  private startScroll = 0;
  private isDragging = false;
  private hasMoved = false;

  constructor() {
    const listeners: [string, (event: Event) => void, boolean][] = [
      ['pointerdown', (event) => this.start(event as PointerEvent), false],
      ['pointermove', (event) => this.move(event as PointerEvent), false],
      ['pointerup', () => this.end(), false],
      ['pointercancel', () => this.end(), false],
      ['click', (event) => this.blockClickAfterDrag(event), true],
    ];
    for (const [type, listener, capture] of listeners) {
      this.element.addEventListener(type, listener, { capture });
    }
    inject(DestroyRef).onDestroy(() => {
      for (const [type, listener, capture] of listeners) {
        this.element.removeEventListener(type, listener, { capture });
      }
    });
  }

  private start(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }
    this.isDragging = true;
    this.hasMoved = false;
    this.startX = event.clientX;
    this.startScroll = this.element.scrollLeft;
  }

  private move(event: PointerEvent): void {
    if (!this.isDragging) {
      return;
    }
    const deltaX = event.clientX - this.startX;
    if (!this.hasMoved && Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
      return;
    }
    if (!this.hasMoved) {
      this.hasMoved = true;
      this.element.style.scrollSnapType = 'none';
      this.element.setPointerCapture?.(event.pointerId);
    }
    this.element.scrollLeft = this.startScroll - deltaX;
  }

  private end(): void {
    if (!this.isDragging) {
      return;
    }
    this.isDragging = false;
    // Al devolver el encaje, el navegador lleva a la tarjeta más cercana
    this.element.style.scrollSnapType = '';
  }

  private blockClickAfterDrag(event: Event): void {
    if (this.hasMoved) {
      event.preventDefault();
      event.stopPropagation();
      this.hasMoved = false;
    }
  }
}
