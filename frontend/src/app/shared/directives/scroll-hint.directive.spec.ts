import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ScrollHint } from './scroll-hint.directive';

@Component({
  imports: [ScrollHint],
  template: `<div appScrollHint #hint="scrollHint"><p>Mario</p></div>`,
})
class HostComponent {}

// Un cuerpo de 400px con 900px de contenido, desplazado scrollTop píxeles
function setSizes(element: HTMLElement, scrollTop: number): void {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, value: 900 },
    scrollTop: { configurable: true, value: scrollTop },
  });
}

describe('ScrollHint', () => {
  let onResize: () => void;
  const disconnect = vi.fn();

  beforeEach(() => {
    onResize = () => undefined;
    disconnect.mockClear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          onResize = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  function render(): {
    body: HTMLElement;
    hint: ScrollHint;
    fixture: ReturnType<typeof TestBed.createComponent<HostComponent>>;
  } {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const body = (fixture.nativeElement as HTMLElement).querySelector('div') as HTMLElement;
    const hint = fixture.debugElement.children[0].injector.get(ScrollHint);
    return { body, hint, fixture };
  }

  it('knows when there is content below while scrolling', () => {
    const { body, hint } = render();
    expect(hint.canScrollDown()).toBe(false);

    setSizes(body, 0);
    body.dispatchEvent(new Event('scroll'));
    expect(hint.canScrollDown()).toBe(true);

    // Casi abajo (a menos de 16px): ya no
    setSizes(body, 490);
    body.dispatchEvent(new Event('scroll'));
    expect(hint.canScrollDown()).toBe(false);
  });

  it('measures again when the body changes size and stops when it is gone', () => {
    const { body, hint, fixture } = render();
    setSizes(body, 0);

    onResize();
    expect(hint.canScrollDown()).toBe(true);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });

  it('scrolls down almost what is visible', () => {
    const { body, hint } = render();
    setSizes(body, 0);
    const scrollBy = vi.fn();
    body.scrollBy = scrollBy;

    hint.scrollDown();

    expect(scrollBy).toHaveBeenCalledWith({ top: 320, behavior: 'smooth' });
  });

  it('works without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { body, hint } = render();
    setSizes(body, 0);
    body.dispatchEvent(new Event('scroll'));
    expect(hint.canScrollDown()).toBe(true);
  });
});
