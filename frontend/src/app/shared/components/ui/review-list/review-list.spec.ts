import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ReviewList, ReviewListItem } from './review-list';

function item(id: string, overrides: Partial<ReviewListItem> = {}): ReviewListItem {
  return {
    id,
    authorName: 'Lucía Cortés',
    publishedAt: '2026-11-16T10:00:00.000Z',
    rating: 4,
    comment: 'Muy puntual.',
    ...overrides,
  };
}

function items(count: number): ReviewListItem[] {
  return Array.from({ length: count }, (_, index) => item(`v${index}`));
}

describe('ReviewList', () => {
  let fixture: ComponentFixture<ReviewList>;
  let onVisible: (entries: { isIntersecting: boolean }[]) => void;
  const disconnect = vi.fn();

  beforeEach(() => {
    onVisible = () => undefined;
    disconnect.mockClear();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof onVisible) {
          onVisible = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  function render(inputs: { items: ReviewListItem[]; total: number }): HTMLElement {
    TestBed.configureTestingModule({
      imports: [ReviewList],
      providers: [provideAppTransloco(), provideIonicAngular()],
    });
    fixture = TestBed.createComponent(ReviewList);
    fixture.componentRef.setInput('items', inputs.items);
    fixture.componentRef.setInput('total', inputs.total);
    fixture.componentRef.setInput('label', 'Tus reseñas');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each review with its medals, comment and trip', () => {
    const root = render({
      items: [
        item('v1', { route: 'Roquetas de Mar → Campus UAL' }),
        item('v2', { comment: null, publishedAt: null }),
      ],
      total: 2,
    });

    const rows = root.querySelectorAll('.review-list__item');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Lucía Cortés');
    expect(rows[0].textContent).toContain('Muy puntual.');
    expect(rows[0].textContent).toContain('Roquetas de Mar → Campus UAL');
    expect(rows[0].querySelectorAll('.rating-medals__medal--filled')).toHaveLength(4);
    expect(rows[1].textContent).toContain('Sin comentario');
    expect(root.querySelector('ul')?.getAttribute('aria-label')).toBe('Tus reseñas');
    // Con 5 o menos, sin el cierre (se ven sin bajar)
    expect(root.querySelector('.review-list__done')).toBeNull();
  });

  it('asks for more when the end is visible, saying so while they arrive', () => {
    const root = render({ items: items(5), total: 7 });
    const reachedEnd = vi.fn();
    fixture.componentInstance.reachedEnd.subscribe(reachedEnd);

    onVisible([{ isIntersecting: false }]);
    expect(reachedEnd).not.toHaveBeenCalled();
    onVisible([{ isIntersecting: true }]);
    expect(reachedEnd).toHaveBeenCalledTimes(1);

    // Mientras llegan, lo dice y no vuelve a pedir
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();
    expect(root.querySelector('.review-list__more')?.textContent).toContain(
      'Cargando más reseñas…',
    );
    onVisible([{ isIntersecting: true }]);
    expect(reachedEnd).toHaveBeenCalledTimes(1);
  });

  it('closes with «Has visto todas» when there were more than five', () => {
    const root = render({ items: items(7), total: 7 });

    expect(root.querySelector('.review-list__more')).toBeNull();
    const done = root.querySelector('.review-list__done')?.textContent ?? '';
    expect(done).toContain('Has visto todas');
    expect(done).toContain('7 valoraciones');
    fixture.destroy();
  });

  it('stops watching the end when it is gone', () => {
    render({ items: items(5), total: 7 });
    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });
});
