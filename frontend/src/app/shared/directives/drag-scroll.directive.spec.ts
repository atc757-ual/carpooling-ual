import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DragScroll } from './drag-scroll.directive';

@Component({
  imports: [DragScroll],
  template: `
    <div appDragScroll class="carousel">
      <button type="button" (click)="clicks = clicks + 1">Tarjeta</button>
    </div>
  `,
})
class HostComponent {
  clicks = 0;
}

// jsdom no tiene PointerEvent: un MouseEvent con pointerType y pointerId
function pointer(type: string, init: { clientX?: number; pointerType?: string; button?: number }) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: init.clientX ?? 0,
    button: init.button ?? 0,
  });
  Object.assign(event, { pointerType: init.pointerType ?? 'mouse', pointerId: 1 });
  return event;
}

describe('DragScroll', () => {
  let carousel: HTMLElement;
  let host: HostComponent;

  beforeEach(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
    carousel = (fixture.nativeElement as HTMLElement).querySelector('.carousel') as HTMLElement;
    carousel.scrollLeft = 100;
    carousel.setPointerCapture = vi.fn();
  });

  it('scrolls the carousel while dragging with the mouse and lets it snap again on release', () => {
    carousel.dispatchEvent(pointer('pointerdown', { clientX: 200 }));
    carousel.dispatchEvent(pointer('pointermove', { clientX: 150 }));

    expect(carousel.scrollLeft).toBe(150);
    expect(carousel.style.scrollSnapType).toBe('none');
    expect(carousel.setPointerCapture).toHaveBeenCalledWith(1);

    carousel.dispatchEvent(pointer('pointerup', {}));
    expect(carousel.style.scrollSnapType).toBe('');
  });

  it('ignores tiny moves, touch and other buttons (a click is still a click)', () => {
    carousel.dispatchEvent(pointer('pointerdown', { clientX: 200 }));
    carousel.dispatchEvent(pointer('pointermove', { clientX: 198 }));
    expect(carousel.scrollLeft).toBe(100);
    carousel.dispatchEvent(pointer('pointercancel', {}));

    carousel.dispatchEvent(pointer('pointerdown', { clientX: 200, pointerType: 'touch' }));
    carousel.dispatchEvent(pointer('pointermove', { clientX: 100 }));
    carousel.dispatchEvent(pointer('pointerdown', { clientX: 200, button: 2 }));
    carousel.dispatchEvent(pointer('pointermove', { clientX: 100 }));
    expect(carousel.scrollLeft).toBe(100);

    carousel.querySelector('button')?.click();
    expect(host.clicks).toBe(1);
  });

  it('swallows the click that ends a drag, but not the next one', () => {
    carousel.dispatchEvent(pointer('pointerdown', { clientX: 200 }));
    carousel.dispatchEvent(pointer('pointermove', { clientX: 120 }));
    carousel.dispatchEvent(pointer('pointerup', {}));

    const button = carousel.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(host.clicks).toBe(0);

    button.click();
    expect(host.clicks).toBe(1);
  });
});
