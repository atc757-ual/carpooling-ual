import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverRating, DriverReview } from '../../../core/models/driver-review.model';
import { DriverReviewsService } from '../../../core/services/users/driver-reviews.service';
import { DriverReviewsModal } from './driver-reviews-modal';

const RATING: DriverRating = {
  average: 4.4,
  count: 5,
  distribution: [
    { rating: 5, count: 3 },
    { rating: 4, count: 1 },
    { rating: 3, count: 1 },
    { rating: 2, count: 0 },
    { rating: 1, count: 0 },
  ],
};

function review(id: string, rating = 5, comment: string | null = 'Muy puntual'): DriverReview {
  return {
    id,
    author: { name: 'Carlos R.', avatarKey: null },
    rating,
    comment,
    publishedAt: '2026-10-27T08:00:00.000Z',
  };
}

describe('DriverReviewsModal', () => {
  let getRating: ReturnType<typeof vi.fn>;
  let list: ReturnType<typeof vi.fn>;
  let dismiss: ReturnType<typeof vi.fn>;

  async function render(): Promise<{ root: HTMLElement; component: DriverReviewsModal }> {
    TestBed.configureTestingModule({
      imports: [DriverReviewsModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: DriverReviewsService, useValue: { getRating, list } },
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    const fixture = TestBed.createComponent(DriverReviewsModal);
    fixture.componentInstance.driverId = 'driver-1';
    fixture.componentInstance.driverName = 'Lucía Cortés';
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
  }

  beforeEach(() => {
    getRating = vi.fn().mockResolvedValue(RATING);
    list = vi.fn().mockResolvedValue({ items: [review('r1'), review('r2', 4, null)], total: 2 });
    dismiss = vi.fn().mockResolvedValue(true);
  });

  it('shows the average, the bars per star and the reviews of the driver', async () => {
    const { root, component } = await render();

    expect(component.title()).toBe('Valoraciones de Lucía');
    expect(list).toHaveBeenCalledWith('driver-1', 0, 5);
    // El resumen tiene sus propios tests (app-rating-summary)
    expect(root.querySelector('.rating-summary__value')?.textContent).toBe('4,4');
    expect(root.querySelectorAll('.rating-summary__bar')).toHaveLength(5);
    // La lista tiene sus propios tests (app-review-list)
    expect(component.items()[1]).toEqual({
      id: 'r2',
      authorName: 'Carlos R.',
      publishedAt: '2026-10-27T08:00:00.000Z',
      rating: 4,
      comment: null,
    });
    const rows = root.querySelectorAll('.review-list__item');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Muy puntual');
    expect(root.querySelector('.modal-body app-scroll-hint')).not.toBeNull();
  });

  it('loads the next five when reaching the end, until all are shown', async () => {
    list
      .mockResolvedValueOnce({ items: [review('r1')], total: 2 })
      .mockResolvedValueOnce({ items: [review('r2')], total: 2 });
    const { component } = await render();

    await component.loadMoreIfAny();

    expect(list).toHaveBeenLastCalledWith('driver-1', 1, 5);
    expect(component.reviews().map(({ id }) => id)).toEqual(['r1', 'r2']);
    // Sin más, no vuelve a pedir
    await component.loadMoreIfAny();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('says so when the driver has no reviews yet', async () => {
    getRating.mockResolvedValue({ ...RATING, average: null, count: 0, distribution: [] });
    list.mockResolvedValue({ items: [], total: 0 });

    const { root } = await render();

    expect(root.textContent).toContain('Aún no tiene valoraciones');
  });

  it('shows the error when the reviews cannot be loaded', async () => {
    getRating.mockRejectedValue(new ApiError('NETWORK_ERROR', 0));

    const { root } = await render();

    expect(root.querySelector('.notice--danger')).not.toBeNull();
    expect(root.textContent).not.toContain('Aún no tiene valoraciones');
  });

  it('keeps the loaded reviews and shows the error when the next page fails', async () => {
    list.mockResolvedValueOnce({ items: [review('r1')], total: 2 });
    const { component } = await render();
    list.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0));

    await component.loadMoreIfAny();

    expect(component.reviews()).toHaveLength(1);
    expect(component.errorMessage()).not.toBeNull();
    expect(component.isLoading()).toBe(false);
  });

  it('closes with the ✕', async () => {
    const { component } = await render();

    component.close();

    expect(dismiss).toHaveBeenCalled();
  });
});
