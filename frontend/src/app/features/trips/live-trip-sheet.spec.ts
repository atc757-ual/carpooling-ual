import { provideAppTransloco } from '../../core/i18n/testing-transloco';
import { Component, signal, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { locationOutline } from 'ionicons/icons';
import { vi } from 'vitest';
import type { LiveSheetController } from '../../shared/utils/desktop-query.util';
import { LiveTripHero, LiveTripSheet } from './live-trip-hero.util';

@Component({ template: '<ng-template #content><p>Detalles</p></ng-template>' })
class ContentHost {
  readonly content = viewChild.required<TemplateRef<unknown>>('content');
}

// La hoja inferior de «En curso»: el ajuste de su parada de arriba al contenido
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

  it('fits the top stop to the content, also with its padding', () => {
    const sheet = fakeSheet(true);
    const component = render(sheet);
    const body = { offsetHeight: 500 } as HTMLElement;
    const fit = (component as unknown as { fit(b: HTMLElement, c: HTMLElement): void }).fit.bind(
      component,
    );

    fit(body, { offsetHeight: 0 } as HTMLElement);
    expect(sheet.fitToContent).not.toHaveBeenCalled();

    fit(body, { offsetHeight: 800 } as HTMLElement);
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    expect(sheet.fitToContent).toHaveBeenCalledWith((500 + 1.5 * rem) / 800);
  });

  it('shows the ETA badge and stale-position warning in the hero card when provided', () => {
    TestBed.configureTestingModule({
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    const fixture = TestBed.createComponent(LiveTripHero);
    fixture.componentRef.setInput('title', 'Rumbo al campus');
    fixture.componentRef.setInput('eta', 'Sin posición');
    fixture.componentRef.setInput('icon', locationOutline);
    fixture.componentRef.setInput('place', 'Campus UAL');
    fixture.componentRef.setInput('stages', [{ label: 'En ruta', state: 'current' }]);
    fixture.componentRef.setInput('warning', 'El conductor no envía su ubicación.');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const tag = root.querySelector('.live-hero__tag');
    expect(tag?.textContent).toContain('Sin posición');
    expect(tag?.classList.contains('live-hero__tag--warning')).toBe(true);
    expect(root.querySelector('.live-hero__warning')?.textContent).toContain(
      'El conductor no envía su ubicación.',
    );
  });
});
