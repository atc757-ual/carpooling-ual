import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverRating, DriverReview } from '../../../core/models/driver-review.model';
import { DriverReviewsService } from '../../../core/services/users/driver-reviews.service';
import { DriverReviewsModal, formatReviewCount, toStars } from './driver-reviews-modal';

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
    expect(list).toHaveBeenCalledWith('driver-1', 0, 10);
    expect(root.querySelector('.driver-reviews__average-value')?.textContent).toBe('4,4');
    expect(root.textContent).toContain('5 valoraciones');
    const bars = root.querySelectorAll('.driver-reviews__bar');
    expect(bars).toHaveLength(5);
    expect(bars[0].getAttribute('aria-label')).toBe('5 estrellas: 3');
    expect(component.bars()[0].percent).toBe(60);
    const items = root.querySelectorAll('.driver-reviews__item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Carlos R.');
    expect(items[0].textContent).toContain('Muy puntual');
    expect(items[1].querySelector('.driver-reviews__comment')).toBeNull();
    expect(root.querySelector('.driver-reviews__more')).toBeNull();
  });

  it('loads the next page with «Ver más» until all the reviews are shown', async () => {
    list
      .mockResolvedValueOnce({ items: [review('r1')], total: 2 })
      .mockResolvedValueOnce({ items: [review('r2')], total: 2 });
    const { component } = await render();
    expect(component.hasMore()).toBe(true);

    await component.loadMore();

    expect(list).toHaveBeenLastCalledWith('driver-1', 1, 10);
    expect(component.reviews().map(({ id }) => id)).toEqual(['r1', 'r2']);
    expect(component.hasMore()).toBe(false);
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

    await component.loadMore();

    expect(component.reviews()).toHaveLength(1);
    expect(component.errorMessage()).not.toBeNull();
    expect(component.isLoadingMore()).toBe(false);
  });

  it('closes with the ✕', async () => {
    const { component } = await render();

    component.close();

    expect(dismiss).toHaveBeenCalled();
  });
});

describe('formatReviewCount', () => {
  it('speaks of one or many reviews', () => {
    expect(formatReviewCount(1)).toBe('1 valoración');
    expect(formatReviewCount(15)).toBe('15 valoraciones');
  });
});

describe('toStars', () => {
  it('fills the stars of the rounded rating', () => {
    expect(toStars(4.4)).toBe('★★★★☆');
    expect(toStars(5)).toBe('★★★★★');
  });
});
