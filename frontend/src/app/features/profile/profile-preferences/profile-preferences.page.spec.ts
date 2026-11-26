import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { Profile, User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ProfileReviewsModal } from '../profile-reviews-modal/profile-reviews-modal';
import { ProfilePreferencesPage } from './profile-preferences.page';

describe('ProfilePreferencesPage', () => {
  const getMe = vi.fn();

  function render(
    profiles: Profile[] = ['passenger'],
    withRatings = true,
  ): { root: HTMLElement; page: ProfilePreferencesPage } {
    const user = signal({
      firstName: 'Ana',
      lastName: 'García',
      email: 'ana@ual.es',
      profiles,
      timeToleranceMin: 20,
      ratings: withRatings
        ? {
            driver: { averageRating: 4.8, ratingCount: 5 },
            passenger: { averageRating: 4.5, ratingCount: 3 },
          }
        : undefined,
    } as User);
    getMe.mockResolvedValue(user());

    TestBed.configureTestingModule({
      imports: [ProfilePreferencesPage],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            hasProfile: (profile: Profile) => user().profiles.includes(profile),
            updateUser: vi.fn(),
          },
        },
        { provide: DriverService, useValue: { listVehicles: vi.fn().mockResolvedValue([]) } },
        {
          provide: UsersService,
          useValue: {
            getMe,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePreferencesPage);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  beforeEach(() => {
    getMe.mockClear();
  });

  it('shows the vehicles component and travel preferences', () => {
    const { root, page } = render(['passenger']);

    expect(root.querySelector('app-profile-vehicles')).not.toBeNull();
    expect(page.timeToleranceLabel()).toBe('± 20 min');
    expect(page.preferencesItems().length).toBeGreaterThan(0);
    expect(page.reviewRows().length).toBe(2);
  });

  it('shows empty reviews message when user has no ratings', () => {
    const { page, root } = render(['passenger'], false);

    expect(page.reviewRows().length).toBe(0);
    expect(root.querySelectorAll('.profile__review-score').length).toBe(0);
  });

  it('opens the edit preferences modal and refreshes when saved', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'saved' });
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present, onDidDismiss } as unknown as HTMLIonModalElement);

    getMe.mockClear();
    await page.handleEditPreferences();
    expect(create).toHaveBeenCalled();
    expect(present).toHaveBeenCalled();
    expect(getMe).toHaveBeenCalled();

    onDidDismiss.mockResolvedValueOnce({ role: 'cancel' });
    getMe.mockClear();
    await page.handleEditPreferences();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('handles default timeToleranceMin, chosen preference values, and ApiError in refreshData', async () => {
    const { page } = render(['passenger'], false);
    const auth = TestBed.inject(AuthService);
    (auth.currentUser as unknown as { set: (u: User | null) => void }).set({
      firstName: 'Ana',
      lastName: 'García',
      email: 'ana@ual.es',
      profiles: ['passenger'],
      preferences: { music: 'pop', chat: 'quiet', smoking: 'no', pets: 'yes' },
    } as unknown as User);
    expect(page.timeToleranceLabel()).toBe('± 15 min');
    expect(page.preferencesItems().length).toBeGreaterThan(0);

    const { ApiError, NETWORK_ERROR } = await import('../../../core/models/api-error.model');
    getMe.mockRejectedValueOnce(new ApiError(NETWORK_ERROR, 0));
    await expect(page.refreshData()).resolves.toBeUndefined();
  });

  it('opens the received reviews in the role of the row', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present } as unknown as HTMLIonModalElement);

    await page.handleOpenReviews('passenger');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        component: ProfileReviewsModal,
        cssClass: ['info-dialog', 'list-dialog'],
        componentProps: { role: 'passenger' },
      }),
    );
    expect(present).toHaveBeenCalled();
  });
});
