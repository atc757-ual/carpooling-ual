import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTestingSupport } from '../../../../core/i18n/testing-transloco';
import { RouteStop, RouteTimeline } from './route-timeline';

describe('RouteTimeline', () => {
  function render(stops: RouteStop[], ariaLabel?: string): HTMLElement {
    const fixture = TestBed.createComponent(RouteTimeline);
    fixture.componentRef.setInput('stops', stops);
    if (ariaLabel !== undefined) {
      fixture.componentRef.setInput('ariaLabel', ariaLabel);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texts = (root: HTMLElement, selector: string): string[] =>
    Array.from(root.querySelectorAll(selector), (element) => element.textContent?.trim() ?? '');

  it('shows each stop with its detail, the origin empty and the destination filled', () => {
    const root = render([
      { name: 'Roquetas de Mar', detail: 'Recogida' },
      { name: 'Campus UAL', detail: 'Ingreso norte' },
    ]);

    expect(texts(root, '.route-timeline__body')).toEqual([
      'Roquetas de MarRecogida',
      'Campus UALIngreso norte',
    ]);
    expect(root.querySelectorAll('.route-timeline__dot--end')).toHaveLength(1);
    expect(root.querySelector('.route-timeline__time')).toBeNull();
    expect(root.querySelector('.route-timeline')?.getAttribute('aria-label')).toBe('Trayecto');
  });

  it('shows the time of each stop when it has one', () => {
    const root = render([
      { name: 'Roquetas de Mar', detail: 'Recogida', time: '07:40' },
      { name: 'Campus UAL', detail: 'Ingreso norte', time: '08:12' },
    ]);

    expect(texts(root, '.route-timeline__time')).toEqual(['07:40', '08:12']);
    expect(root.querySelector('.route-timeline--timed')).not.toBeNull();
  });

  it('supports translating aria-label or overriding it', () => {
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTestingSupport({
          en: { common: { routeTimeline: { aria: 'Route' } } },
        }),
      ],
    });
    TestBed.inject(TranslocoService).setActiveLang('en');

    const englishRoot = render([{ name: 'A', detail: 'B' }]);
    expect(englishRoot.querySelector('.route-timeline')?.getAttribute('aria-label')).toBe('Route');

    const customRoot = render([{ name: 'A', detail: 'B' }], 'Custom route');
    expect(customRoot.querySelector('.route-timeline')?.getAttribute('aria-label')).toBe(
      'Custom route',
    );
  });
});
