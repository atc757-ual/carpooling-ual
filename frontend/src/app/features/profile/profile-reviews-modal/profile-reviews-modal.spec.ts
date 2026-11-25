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
    // El resumen y la lista tienen sus propios tests
    expect(root.querySelector('.rating-summary__value')?.textContent).toBe('4,8');
    expect(fixture.componentInstance.items()).toEqual([
      {
        id: 'v1',
        authorName: 'Lucía Cortés',
        publishedAt: '2026-11-16T10:00:00.000Z',
        rating: 5,
        comment: 'Muy puntual.',
        route: 'Roquetas de Mar → Campus UAL',
      },
    ]);
    expect(root.querySelector('.review-list__item')?.textContent).toContain('Lucía Cortés');
    // «Desliza para ver más», en el cuerpo que se desplaza
    expect(root.querySelector('.modal-body app-scroll-hint')).not.toBeNull();
  });

  it('leaves out the missing place of the trip', async () => {
    listReceived.mockResolvedValueOnce({
      items: [
        review('v2', {
          trip: { originName: null, destinationName: 'Campus UAL', departureAt: '' },
        }),
      ],
      total: 1,
    });
    await render();

    expect(fixture.componentInstance.items()[0].route).toBe('Campus UAL');
  });

  it('pages five by five, keeping the summary', async () => {
    listReceived.mockResolvedValueOnce({ items: reviews(0, 5), total: 6 });
    await render({ role: 'driver' });
    const modal = fixture.componentInstance;

    listReceived.mockResolvedValueOnce({ items: reviews(5, 1), total: 6 });
    await modal.loadMoreIfAny();
    expect(listReceived).toHaveBeenLastCalledWith('driver', 5, 5);
    expect(getMyRating).toHaveBeenCalledTimes(1);
    expect(modal.summary()).toEqual(RATING);
    expect(modal.items()).toHaveLength(6);

    // Sin más, no vuelve a pedir
    await modal.loadMoreIfAny();
    expect(listReceived).toHaveBeenCalledTimes(2);
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
