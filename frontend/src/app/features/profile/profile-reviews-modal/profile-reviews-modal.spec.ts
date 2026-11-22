import { provideAppTransloco } from '../../../core/i18n/testing-transloco';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import {
  ReceivedReview,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { ProfileReviewsModal } from './profile-reviews-modal';

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

describe('ProfileReviewsModal', () => {
  let fixture: ComponentFixture<ProfileReviewsModal>;
  const listReceived = vi.fn();
  const dismiss = vi.fn().mockResolvedValue(true);

  async function render(inputs: Partial<ProfileReviewsModal> = {}): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [ProfileReviewsModal],
      providers: [
        provideAppTransloco(),
        provideIonicAngular(),
        { provide: TripReviewsService, useValue: { listReceived } },
        { provide: ModalController, useValue: { dismiss } },
      ],
    });
    fixture = TestBed.createComponent(ProfileReviewsModal);
    Object.assign(fixture.componentInstance, inputs);
    fixture.detectChanges();
    await settle();
    return fixture.nativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    listReceived.mockResolvedValue({ items: [review('v1')], total: 1 });
  });

  it('opens in the role of the row and lists its reviews with the trip', async () => {
    const root = await render({ roles: ['driver', 'passenger'], initialRole: 'passenger' });

    expect(listReceived).toHaveBeenCalledWith('passenger', 0, 10);
    expect(root.querySelector('ion-title')?.textContent).toContain('Tus reseñas');
    const selected = root.querySelector('.segmented-tabs__option--selected');
    expect(selected?.textContent).toContain('Como pasajero');
    const item = root.querySelector('.profile-reviews__item')?.textContent ?? '';
    expect(item).toContain('Lucía Cortés');
    expect(item).toContain('Muy puntual.');
    expect(item).toContain('Roquetas de Mar → Campus UAL');
    expect(root.querySelector('.profile-reviews__thumb--up')).not.toBeNull();
  });

  it('loads each role once, when its tab is opened', async () => {
    const root = await render({ roles: ['driver', 'passenger'], initialRole: 'driver' });
    const modal = fixture.componentInstance;
    listReceived.mockResolvedValue({
      items: [review('v2', { rating: 2, comment: null, publishedAt: null })],
      total: 1,
    });

    root.querySelectorAll<HTMLButtonElement>('.segmented-tabs__option')[1].click();
    await settle();
    expect(listReceived).toHaveBeenLastCalledWith('passenger', 0, 10);
    expect(root.querySelector('.profile-reviews__thumb--down')).not.toBeNull();
    expect(modal.date(null)).toBe('');

    modal.handleRole('driver');
    await settle();
    expect(listReceived).toHaveBeenCalledTimes(2);
    expect(modal.reviews()[0].id).toBe('v1');
  });

  it('shows no tabs with a single role and pages ten by ten', async () => {
    listReceived.mockResolvedValueOnce({
      items: Array.from({ length: 10 }, (_, index) => review(`v${index}`)),
      total: 11,
    });
    const root = await render({ roles: ['driver'], initialRole: 'passenger' });
    const modal = fixture.componentInstance;

    expect(root.querySelector('.segmented-tabs')).toBeNull();
    expect(listReceived).toHaveBeenCalledWith('driver', 0, 10);
    expect(modal.hasMore()).toBe(true);

    listReceived.mockResolvedValueOnce({ items: [review('v10')], total: 11 });
    await modal.loadMore();
    expect(listReceived).toHaveBeenLastCalledWith('driver', 10, 10);
    expect(modal.reviews()).toHaveLength(11);
    expect(modal.hasMore()).toBe(false);
  });

  it('says when a role has no reviews and shows the error when loading fails', async () => {
    listReceived.mockResolvedValueOnce({ items: [], total: 0 });
    const root = await render({ roles: ['driver'] });
    expect(root.querySelector('.profile-reviews__empty')).not.toBeNull();

    listReceived.mockRejectedValueOnce(new ApiError('INTERNAL_ERROR', 500));
    fixture.componentInstance.handleRole('passenger');
    await settle();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('.profile-reviews__empty')).toBeNull();
  });

  it('closes with the ✕', async () => {
    const root = await render();
    root.querySelector('app-modal-header form')?.dispatchEvent(new Event('submit'));
    expect(dismiss).toHaveBeenCalled();
  });
});
