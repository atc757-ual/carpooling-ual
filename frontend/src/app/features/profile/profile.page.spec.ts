import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController, NavController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../core/i18n/testing-transloco';
import { PreferencesPlugin } from '../../core/plugins/preferences-plugin';
import { Profile, User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { DriverService } from '../../core/services/drivers/driver.service';
import { LocationService } from '../../core/services/location/location.service';
import { LocationConsentService } from '../../core/services/location/location-consent.service';
import { UsersService } from '../../core/services/users/users.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { LanguageService } from '../../core/services/ui/language.service';
import { ThemeService } from '../../core/services/ui/theme.service';
import { ProfilePage } from './profile.page';

describe('ProfilePage', () => {
  const logout = vi.fn().mockResolvedValue(undefined);
  const getMe = vi.fn();
  const getMyConsents = vi.fn().mockResolvedValue({
    current: { terms: null, privacy: null, location: null },
    history: [],
  });
  const setLocationConsent = vi.fn().mockResolvedValue({
    current: { terms: null, privacy: null, location: { action: 'granted' } },
    history: [],
  });
  const checkPermission = vi.fn().mockResolvedValue('prompt');

  function render(
    profiles: Profile[] = ['passenger'],
    name = 'Ana García',
  ): { root: HTMLElement; page: ProfilePage } {
    const user = signal({
      name,
      email: 'ana@ual.es',
      phone: '+34612345678',
      profiles,
    } as User);
    getMe.mockResolvedValue(user());

    TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        provideTestingTransloco({
          es: {
            profile: {
              settings: 'Configuración',
              language: 'Idioma',
              theme: 'Tema',
            },
          },
        }),
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            hasProfile: (profile: Profile) => user().profiles.includes(profile),
            logout,
            updateUser: vi.fn(),
          },
        },
        { provide: DriverService, useValue: { listVehicles: vi.fn().mockResolvedValue([]) } },
        {
          provide: UsersService,
          useValue: {
            getMe,
            getMyConsents,
            setLocationConsent,
          },
        },
        {
          provide: LocationService,
          useValue: {
            checkPermission,
            checkDevicePermission: vi.fn().mockResolvedValue('prompt'),
          },
        },
        {
          provide: LocationConsentService,
          useValue: {
            load: vi.fn().mockResolvedValue({
              current: { terms: null, privacy: null, location: null },
              history: [],
            }),
            set: setLocationConsent,
          },
        },
        {
          provide: PreferencesPlugin,
          useValue: {
            get: vi.fn().mockResolvedValue(null),
            set: vi.fn().mockResolvedValue(undefined),
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
    getMyConsents.mockClear();
  });

  it('shows the account with the initials and the phone', () => {
    const { root, page } = render();

    expect(page.initials()).toBe('AG');
    expect(root.textContent).toContain('Ana García');
    expect(root.textContent).toContain('ana@ual.es');
    expect(root.textContent).toContain('+34 612 345 678');
  });

  it('formats the name for display without changing the account value', () => {
    const { root, page } = render(['passenger'], 'ANA GARCÍA');

    expect(root.querySelector('.profile__name')?.textContent?.trim()).toBe('Ana García');
    expect(page.user()?.name).toBe('ANA GARCÍA');
  });

  it('shows the vehicles to everyone (the first one makes a driver)', () => {
    expect(render(['passenger']).root.querySelector('app-profile-vehicles')).not.toBeNull();
  });

  it('opens the legal texts', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present } as unknown as HTMLIonModalElement);

    await page.handleOpenLegal('privacy');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ componentProps: { document: 'privacy' } }),
    );
    expect(present).toHaveBeenCalled();
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

  it('opens the edit public modal', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'cancel' });
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present, onDidDismiss } as unknown as HTMLIonModalElement);

    await page.handleEditPublic();
    expect(create).toHaveBeenCalled();
    expect(present).toHaveBeenCalled();
  });

  it('opens the edit preferences modal', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'cancel' });
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present, onDidDismiss } as unknown as HTMLIonModalElement);

    await page.handleEditPreferences();
    expect(create).toHaveBeenCalled();
    expect(present).toHaveBeenCalled();
  });

  it('opens the phone management modal', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'cancel' });
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present, onDidDismiss } as unknown as HTMLIonModalElement);

    await page.handleManagePhone();
    expect(create).toHaveBeenCalled();
    expect(present).toHaveBeenCalled();
  });

  it('changes language via language service', () => {
    const { page } = render();
    const langSpy = vi.spyOn(TestBed.inject(LanguageService), 'setLanguage');
    page.handleSelectLanguage('en');
    expect(langSpy).toHaveBeenCalledWith('en');
  });

  it('toggles theme via theme service', () => {
    const { page } = render();
    const themeSpy = vi.spyOn(TestBed.inject(ThemeService), 'toggle').mockResolvedValue();
    page.handleToggleTheme();
    expect(themeSpy).toHaveBeenCalled();
  });
});
