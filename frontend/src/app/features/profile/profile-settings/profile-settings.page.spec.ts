import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../core/i18n/testing-transloco';
import { PreferencesPlugin } from '../../../core/plugins/preferences-plugin';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { LocationService } from '../../../core/services/location/location.service';
import { LocationConsentService } from '../../../core/services/location/location-consent.service';
import { PushNotificationsService } from '../../../core/services/push/push-notifications.service';
import { ThemeService } from '../../../core/services/ui/theme.service';
import { LegalDocumentsService } from '../../../core/services/users/legal-documents.service';
import { UsersService } from '../../../core/services/users/users.service';
import { ProfileSettingsPage } from './profile-settings.page';

describe('ProfileSettingsPage', () => {
  const getMe = vi.fn();
  const setLocationConsent = vi.fn().mockResolvedValue({
    current: { terms: null, privacy: null, location: { action: 'granted' } },
    outdated: [],
    history: [],
  });
  const checkPermission = vi.fn().mockResolvedValue('prompt');

  function render(
    phone: string | null = '+34612345678',
    phoneVerified = true,
  ): { root: HTMLElement; page: ProfileSettingsPage } {
    const user = signal({
      firstName: 'Ana',
      lastName: 'García',
      email: 'ana@ual.es',
      phone,
      phoneVerified,
      profiles: ['passenger'],
    } as User);
    getMe.mockResolvedValue(user());

    TestBed.configureTestingModule({
      imports: [ProfileSettingsPage],
      providers: [
        provideIonicAngular(),
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
          provide: PushNotificationsService,
          useValue: { status: signal('off'), enable: vi.fn(), disable: vi.fn() },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: user,
            updateUser: vi.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            getMe,
            setLocationConsent,
          },
        },
        {
          provide: LegalDocumentsService,
          useValue: {
            getCurrent: vi.fn().mockResolvedValue(null),
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
              outdated: [],
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
    const fixture = TestBed.createComponent(ProfileSettingsPage);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  beforeEach(() => {
    getMe.mockClear();
  });

  it('shows the formatted phone and verified badge', () => {
    const { root, page } = render('+34612345678', true);

    expect(page.phone()).toBe('+34 612 345 678');
    expect(page.isPhoneVerified()).toBe(true);
    expect(root.textContent).toContain('+34 612 345 678');
    expect(root.querySelector('output.status--accepted')).not.toBeNull();
  });

  it('shows verify button when phone is not verified, and empty message when no phone', () => {
    const unverified = render('+34612345678', false);
    expect(unverified.root.querySelector('.profile__verify')).not.toBeNull();

    TestBed.resetTestingModule();
    const empty = render(null, false);
    expect(empty.page.phone()).toBeNull();
    expect(empty.root.querySelector('.profile__empty-text')).not.toBeNull();
  });

  it('opens the phone management modal and refreshes when saved', async () => {
    const { page } = render();
    const present = vi.fn().mockResolvedValue(undefined);
    const onDidDismiss = vi.fn().mockResolvedValue({ role: 'saved' });
    const create = vi
      .spyOn(TestBed.inject(ModalController), 'create')
      .mockResolvedValue({ present, onDidDismiss } as unknown as HTMLIonModalElement);

    getMe.mockClear();
    await page.handleManagePhone();
    expect(create).toHaveBeenCalled();
    expect(present).toHaveBeenCalled();
    expect(getMe).toHaveBeenCalled();

    onDidDismiss.mockResolvedValueOnce({ role: 'cancel' });
    getMe.mockClear();
    await page.handleManagePhone(true);
    expect(getMe).not.toHaveBeenCalled();
  });

  it('shows legal document accepted versions, minor updates and handles ApiError in refreshData', async () => {
    const { page } = render();
    page.consents.set({
      current: {
        terms: {
          documentType: 'terms',
          version: '1.0',
          acceptedAt: '2026-10-01T10:00:00Z',
          fingerprintSha256: 'a'.repeat(64),
        },
        privacy: {
          documentType: 'privacy',
          version: '1.0',
          acceptedAt: '2026-10-01T10:00:00Z',
          fingerprintSha256: 'b'.repeat(64),
        },
        location: null,
      },
      outdated: [],
      history: [],
    } as never);
    expect(page.legalDocs()[0].acceptedVersion).toBe('1.0');

    const { ApiError, NETWORK_ERROR } = await import('../../../core/models/api-error.model');
    getMe.mockRejectedValueOnce(new ApiError(NETWORK_ERROR, 0));
    await expect(page.refreshData()).resolves.toBeUndefined();
  });

  it('sets theme via theme service', () => {
    const { page } = render();
    const themeSpy = vi.spyOn(TestBed.inject(ThemeService), 'set').mockResolvedValue();
    page.handleSetTheme(true);
    expect(themeSpy).toHaveBeenCalledWith(true);
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
});
