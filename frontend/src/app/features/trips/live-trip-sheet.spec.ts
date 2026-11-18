import { Component, signal, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import type { LiveSheetController } from '../../shared/utils/desktop-query.util';
import { LiveTripSheet } from './live-trip-hero.util';

@Component({ template: '<ng-template #content><p>Detalles</p></ng-template>' })
class ContentHost {
  readonly content = viewChild.required<TemplateRef<unknown>>('content');
}

// La hoja inferior de «En curso»: la flecha «Ver más» y el ajuste al contenido
describe('LiveTripSheet', () => {
  function fakeSheet(isDesktop: boolean) {
    return {
      isDesktop: signal(isDesktop),
      isOnPage: signal(true),
      isOpen: signal(!isDesktop),
      breakpoints: [0.2, 0.45],
      initialBreakpoint: 0.45,
      breakpoint: signal(0.45),
      mapInset: signal(0),
      canDismiss: () => Promise.resolve(true),
      setModal: vi.fn(),
      enter: vi.fn(),
      close: vi.fn(),
      expand: vi.fn(),
      fitToContent: vi.fn(),
      expandStep: vi.fn(),
    } satisfies LiveSheetController;
  }

  function render(sheet: LiveSheetController) {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    const host = TestBed.createComponent(ContentHost);
    host.detectChanges();
    const fixture = TestBed.createComponent(LiveTripSheet);
    fixture.componentRef.setInput('sheet', sheet);
    fixture.componentRef.setInput('content', host.componentInstance.content());
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('hides the «Ver más» arrow while touching and brings it back once released', () => {
    vi.useFakeTimers();
    const component = render(fakeSheet(true));

    component.isTouching.set(true);
    component.handleRelease();
    expect(component.isTouching()).toBe(true);
    vi.advanceTimersByTime(400);
    expect(component.isTouching()).toBe(false);
    vi.useRealTimers();
  });

  it('fits the top stop to the content and shows the arrow when it does not fit', () => {
    const sheet = fakeSheet(true);
    const component = render(sheet);
    const body = { offsetHeight: 500 } as HTMLElement;
    const content = { offsetHeight: 800 } as HTMLElement;
    const fit = (component as unknown as { fit(b: HTMLElement, c: HTMLElement): void }).fit.bind(
      component,
    );

    fit(body, { offsetHeight: 0 } as HTMLElement);
    expect(sheet.fitToContent).not.toHaveBeenCalled();

    fit(body, content);
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const needed = 500 + 1.5 * rem;
    expect(sheet.fitToContent).toHaveBeenCalledWith(needed / 800);
    // A media pantalla (45 % de 800 = 360px) el contenido no cabe: la flecha sale
    expect(component.visiblePx()).toBe(360);
    expect(component.hasMoreBelow()).toBe(true);

    sheet.breakpoint.set(1);
    expect(component.hasMoreBelow()).toBe(false);
  });
});
