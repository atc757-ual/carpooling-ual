import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverRating } from '../../../core/models/driver-review.model';
import {
  ReceivedReview,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { ProfileReviewsModal } from './profile-reviews-modal';

const RATING: DriverRating = {
  average: 4.8,
  count: 6,
  distribution: [
    { rating: 5, count: 5 },
    { rating: 4, count: 1 },
    { rating: 3, count: 0 },
    { rating: 2, count: 0 },
    { rating: 1, count: 0 },
  ],
};

function review(id: string, overrides: Partial<ReceivedReview> = {}): ReceivedReview {
  return {
    id,
    trip: {
      originName: 'Roquetas de Mar',
      destinationName: 'Campus UAL',
      departureAt: '2026-11-15T07:30:00.000Z',
    },
    author: { name: 'Lucía Cortés' },
    rating: 5,
    comment: 'Muy puntual.',
    publishedAt: '2026-11-16T10:00:00.000Z',
    ...overrides,
  };
}

function reviews(from: number, count: number): ReceivedReview[] {
  return Array.from({ length: count }, (_, index) => review(`v${from + index}`));
}

describe('ProfileReviewsModal', () => {
  let fixture: ComponentFixture<ProfileReviewsModal>;
  const listReceived = vi.fn();
  const getMyRating = vi.fn();
  const dismiss = vi.fn().mockResolvedValue(true);

  async function render(inputs: Partial<ProfileReviewsModal> = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [ProfileReviewsModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: TripReviewsService, useValue: { listReceived, getMyRating } },
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    fixture = TestBed.createComponent(ProfileReviewsModal);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  // Hasta que terminen las peticiones (la lista y la nota)
  async function settle(): Promise<void> {
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    listReceived.mockResolvedValue({ items: [review('v1')], total: 1 });
    getMyRating.mockResolvedValue(RATING);
  });

  it('opens the role of the row with its summary and its reviews, without tabs', async () => {
    const root = await render({ role: 'passenger' });

    expect(listReceived).toHaveBeenCalledWith('passenger', 0, 5);
    expect(getMyRating).toHaveBeenCalledWith('passenger');
    expect(root.querySelector('ion-title')?.textContent).toContain('Tus reseñas · Pasajero');
    expect(root.querySelector('.segmented-tabs')).toBeNull();
    // El resumen tiene sus propios tests (app-rating-summary)
    expect(root.querySelector('.rating-summary__value')?.textContent).toBe('4,8');
    const item = root.querySelector('.profile-reviews__item')?.textContent ?? '';
    expect(item).toContain('Lucía Cortés');
    expect(item).toContain('Muy puntual.');
    expect(item).toContain('Roquetas de Mar → Campus UAL');
    expect(root.querySelector('.profile-reviews__thumb--up')).not.toBeNull();
  });

  it('shows a low rating without comment or date', async () => {
    listReceived.mockResolvedValue({
      items: [review('v2', { rating: 2, comment: null, publishedAt: null })],
      total: 1,
    });
    const root = await render({ role: 'driver' });

    expect(root.querySelector('.profile-reviews__thumb--down')).not.toBeNull();
    expect(root.querySelector('.profile-reviews__comment')?.textContent).toContain(
      'Sin comentario',
    );
    expect(fixture.componentInstance.date(null)).toBe('');
    // Con 5 o menos, sin el cierre (se ven sin bajar)
    expect(root.querySelector('.profile-reviews__done')).toBeNull();
  });

  it('invites to scroll while there is list below and scrolls on tap', async () => {
    const root = await render();
    const body = root.querySelector<HTMLElement>('.modal-body');
    if (!body) {
      throw new Error('Sin .modal-body');
    }
    const scrollBy = vi.fn();
    body.scrollBy = scrollBy;
    Object.defineProperty(body, 'scrollHeight', { value: 900, configurable: true });
    Object.defineProperty(body, 'clientHeight', { value: 400, configurable: true });

    body.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    const hint = root.querySelector<HTMLButtonElement>('.profile-reviews__hint');
    expect(hint?.textContent).toContain('Desliza para ver más');
    hint?.click();
    expect(scrollBy).toHaveBeenCalledWith({ top: 320, behavior: 'smooth' });

    // Al llegar abajo, se va
    body.scrollTop = 500;
    body.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();
    expect(root.querySelector('.profile-reviews__hint')).toBeNull();
  });

  it('measures again when the sheet changes size', async () => {
    let onResize: () => void = () => undefined;
    const disconnect = vi.fn();
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
    const root = await render();
    const body = root.querySelector<HTMLElement>('.modal-body');
    if (!body) {
      throw new Error('Sin .modal-body');
    }
    Object.defineProperty(body, 'scrollHeight', { value: 900 });
    Object.defineProperty(body, 'clientHeight', { value: 400 });

    onResize();
    expect(fixture.componentInstance.canScrollDown()).toBe(true);
    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });

  it('pages five by five, keeping the summary', async () => {
    listReceived.mockResolvedValueOnce({ items: reviews(0, 5), total: 6 });
    await render({ role: 'driver' });
    const modal = fixture.componentInstance;

    expect(listReceived).toHaveBeenCalledWith('driver', 0, 5);
    expect(modal.hasMore()).toBe(true);

    listReceived.mockResolvedValueOnce({ items: reviews(5, 1), total: 6 });
    await modal.loadMoreIfAny();
    expect(listReceived).toHaveBeenLastCalledWith('driver', 5, 5);
    expect(getMyRating).toHaveBeenCalledTimes(1);
    expect(modal.summary()).toEqual(RATING);
    expect(modal.reviews()).toHaveLength(6);
    expect(modal.hasMore()).toBe(false);

    await modal.loadMoreIfAny();
    expect(listReceived).toHaveBeenCalledTimes(2);
  });

  it('loads the next five on its own when scrolling to the end, saying so', async () => {
    let onVisible: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
    const disconnect = vi.fn();
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
    listReceived.mockResolvedValueOnce({ items: reviews(0, 5), total: 7 });
    const root = await render({ role: 'driver' });
    expect(root.querySelectorAll('.profile-reviews__item')).toHaveLength(5);
    // Quedan más: aún sin el cierre
    expect(root.querySelector('.profile-reviews__done')).toBeNull();

    let arrive: (page: { items: ReceivedReview[]; total: number }) => void = () => undefined;
    listReceived.mockReturnValueOnce(new Promise((resolve) => (arrive = resolve)));
    onVisible([{ isIntersecting: false }]);
    expect(listReceived).toHaveBeenCalledTimes(1);
    onVisible([{ isIntersecting: true }]);
    fixture.detectChanges();
    // Mientras llegan, lo dice al final de la lista
    expect(root.querySelector('.profile-reviews__more')?.textContent).toContain(
      'Cargando más reseñas…',
    );

    arrive({ items: reviews(5, 2), total: 7 });
    await settle();

    expect(listReceived).toHaveBeenLastCalledWith('driver', 5, 5);
    expect(fixture.componentInstance.reviews()).toHaveLength(7);
    // Ya no quedan: sin final que observar y con el cierre
    expect(root.querySelector('.profile-reviews__more')).toBeNull();
    const done = root.querySelector('.profile-reviews__done')?.textContent ?? '';
    expect(done).toContain('Has visto todas');
    expect(done).toContain('7 valoraciones');
    fixture.destroy();
    expect(disconnect).toHaveBeenCalled();
  });

  it('says when the role has no reviews', async () => {
    listReceived.mockResolvedValueOnce({ items: [], total: 0 });
    getMyRating.mockResolvedValueOnce({ average: null, count: 0, distribution: [] });
    const root = await render({ role: 'driver' });

    expect(root.querySelector('.profile-reviews__empty')).not.toBeNull();
    expect(root.querySelector('app-rating-summary')).toBeNull();
  });

  it('shows the error when loading fails', async () => {
    listReceived.mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 500));
    const root = await render({ role: 'passenger' });

    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('.profile-reviews__empty')).toBeNull();
  });

  it('closes with the ✕', async () => {
    const root = await render();
    root.querySelector('app-modal-header form')?.dispatchEvent(new Event('submit'));
    expect(dismiss).toHaveBeenCalled();
  });
});
