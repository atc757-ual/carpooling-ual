import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ScrollEdges } from './scroll-edges.directive';

@Component({
  imports: [ScrollEdges],
  template: `<ul appScrollEdges #edges="scrollEdges">
    <li>Mario</li>
  </ul>`,
})
class HostComponent {}

// Una fila de 300px con 500px de contenido, desplazada scrollLeft píxeles
function setSizes(element: HTMLElement, scrollLeft: number): void {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: 300 },
    scrollWidth: { configurable: true, value: 500 },
    scrollLeft: { configurable: true, value: scrollLeft },
  });
}

describe('ScrollEdges', () => {
  // jsdom no tiene ResizeObserver
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  function render(): { list: HTMLElement; edges: ScrollEdges } {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const list = (fixture.nativeElement as HTMLElement).querySelector('ul') as HTMLElement;
    const edges = fixture.debugElement.children[0].injector.get(ScrollEdges);
    return { list, edges };
  }

  it.each([
    ['at the start, only forward', 0, false, true],
    ['in the middle, both sides', 100, true, true],
    ['at the end, only back', 200, true, false],
  ])('%s', (_case, scrollLeft, canScrollBack, canScrollForward) => {
    const { list, edges } = render();
    setSizes(list, scrollLeft);

    list.dispatchEvent(new Event('scroll'));

    expect(edges.canScrollBack()).toBe(canScrollBack);
    expect(edges.canScrollForward()).toBe(canScrollForward);
  });

  it('shows no arrows when everything fits', () => {
    const { list, edges } = render();
    Object.defineProperties(list, {
      clientWidth: { configurable: true, value: 300 },
      scrollWidth: { configurable: true, value: 300 },
      scrollLeft: { configurable: true, value: 0 },
    });

    edges.update();

    expect(edges.canScrollBack()).toBe(false);
    expect(edges.canScrollForward()).toBe(false);
  });

  it('moves almost a whole view to each side', () => {
    const { list, edges } = render();
    setSizes(list, 0);
    const scrollBy = vi.fn();
    list.scrollBy = scrollBy;

    edges.scrollStep(1);
    edges.scrollStep(-1);

    expect(scrollBy).toHaveBeenNthCalledWith(1, { left: 240, behavior: 'smooth' });
    expect(scrollBy).toHaveBeenNthCalledWith(2, { left: -240, behavior: 'smooth' });
  });
});
