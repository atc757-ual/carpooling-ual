import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController, NavController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../core/i18n/testing-transloco';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { UsersService } from '../../core/services/users/users.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  const logout = vi.fn().mockResolvedValue(undefined);
  const getMe = vi.fn();

  function render(
    profiles: Profile[] = ['passenger'],
    [firstName, lastName] = ['Ana', 'García'],
    bio: string | null = 'Estudiante de informática',
  ): { root: HTMLElement; page: ProfilePage } {
    const user = signal({
      firstName,
      lastName,
      email: 'ana@ual.es',
      phone: '+34612345678',
      bio,
      profiles,
    } as User);
    getMe.mockResolvedValue(user());

    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideTestingTransloco(),
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            hasProfile: (profile: Profile) => user().profiles.includes(profile),
            logout,
            updateUser: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getMe,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  function confirmWith(role: string): void {
    vi.spyOn(TestBed.inject(ConfirmService), 'ask').mockResolvedValue(role === 'destructive');
  }

  beforeEach(() => {
    logout.mockClear();
    getMe.mockClear();
  });

  it('shows the account with the initials, email and bio', () => {
    const { root, page } = render();

    expect(page.initials()).toBe('AG');
    expect(root.textContent).toContain('Ana García');
    expect(root.textContent).toContain('ana@ual.es');
    expect(root.textContent).toContain('Estudiante de informática');
  });

  it('shows empty bio placeholder when user has no bio', () => {
    const { root } = render(['passenger'], ['Ana', 'García'], null);

    expect(root.querySelector('.profile__bio-empty')).not.toBeNull();
  });

  it('formats the name for display without changing the account value', () => {
    const { root, page } = render(['passenger'], ['ANA', 'GARCÍA']);

    expect(root.querySelector('.profile__name')?.textContent?.trim()).toBe('Ana García');
    expect(page.user()?.lastName).toBe('GARCÍA');
  });

  it('logs out after confirming it and goes back to the welcome screen', async () => {
    const { page } = render();
    const navigate = vi
      .spyOn(TestBed.inject(NavController), 'navigateRoot')
      .mockResolvedValue(true);

    confirmWith('cancel');
    await page.handleLogout();
    expect(logout).not.toHaveBeenCalled();

    confirmWith('destructive');
    await page.handleLogout();
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/auth/welcome');
  });

  it('opens the edit public modal and refreshes when saved', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'saved' });
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present, onDidDismiss } as unknown as HTMLIonModalElement);

    getMe.mockClear();
    await page.handleEditPublic();
    expect(create).toHaveBeenCalled();
    expect(present).toHaveBeenCalled();
    expect(getMe).toHaveBeenCalled();

    onDidDismiss.mockResolvedValueOnce({ role: 'cancel' });
    getMe.mockClear();
    await page.handleEditPublic();
    expect(getMe).not.toHaveBeenCalled();
  });

  it('keeps local user state when getMe fails with an ApiError', async () => {
    const { page } = render();
    const { ApiError, NETWORK_ERROR } = await import('../../core/models/api-error.model');
    getMe.mockRejectedValueOnce(new ApiError(NETWORK_ERROR, 0));

    await expect(page.refreshData()).resolves.toBeUndefined();
  });

  it('opens the change password modal', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present } as unknown as HTMLIonModalElement);

    await page.handleOpenPassword();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cssClass: 'info-dialog' }));
    expect(present).toHaveBeenCalled();
  });

  it('opens the delete account modal', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present } as unknown as HTMLIonModalElement);

    await page.handleOpenDeleteAccount();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ cssClass: 'info-dialog' }));
    expect(present).toHaveBeenCalled();
  });

  it('links to trip preferences, settings & privacy, and Help & support', () => {
    const { root } = render();

    const links = Array.from(root.querySelectorAll('ion-item.profile__legal-row[href]')).map((el) =>
      el.getAttribute('href'),
    );
    expect(links).toContain('/tabs/profile/preferences');
    expect(links).toContain('/tabs/profile/settings');
    expect(links).toContain('/tabs/profile/help');
  });
});
