import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../i18n/testing-transloco';
import { ApiError } from '../../models/api-error.model';
import { BiometricPlugin } from '../../plugins/biometric-plugin';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from './auth.service';
import { BiometricLoginService } from './biometric-login.service';

const CREDENTIALS = { email: 'ana@ual.es', password: 'secret-password' };

describe('BiometricLoginService', () => {
  let service: BiometricLoginService;
  let stored: Map<string, string>;
  const login = vi.fn();
  const biometric = {
    isAvailable: vi.fn(),
    save: vi.fn(),
    read: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stored = new Map();
    biometric.isAvailable.mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        { provide: AuthService, useValue: { login } },
        { provide: BiometricPlugin, useValue: biometric },
        {
          provide: PreferencesPlugin,
          useValue: {
            get: (key: string) => Promise.resolve(stored.get(key) ?? null),
            set: (key: string, value: string) => Promise.resolve(void stored.set(key, value)),
            remove: (key: string) => Promise.resolve(void stored.delete(key)),
          },
        },
      ],
    });
    service = TestBed.inject(BiometricLoginService);
  });

  it('loads whether it is on for this device', async () => {
    stored.set('auth.biometric-email', 'ana@ual.es');

    await service.load();
    expect(service.isAvailable()).toBe(true);
    expect(service.enabledEmail()).toBe('ana@ual.es');

    biometric.isAvailable.mockResolvedValue(false);
    await service.load();
    expect(service.isAvailable()).toBe(false);
    expect(service.isEnabled()).toBe(false);
  });

  it('offers it once per account, only with biometrics', async () => {
    expect(await service.shouldOffer('ana@ual.es')).toBe(true);

    await service.decline('ana@ual.es');
    expect(await service.shouldOffer('ana@ual.es')).toBe(false);
    expect(await service.shouldOffer('pia@ual.es')).toBe(true);

    biometric.isAvailable.mockResolvedValue(false);
    expect(await service.shouldOffer('pia@ual.es')).toBe(false);
  });

  it('turns it on after the fingerprint and stops offering it', async () => {
    biometric.save.mockResolvedValue(true);
    await service.decline('ana@ual.es');

    expect(await service.enable(CREDENTIALS)).toBe(true);
    expect(service.enabledEmail()).toBe('ana@ual.es');
    expect(stored.has('auth.biometric-declined-email')).toBe(false);
    expect(await service.shouldOffer('ana@ual.es')).toBe(false);
  });

  it('stays off when the fingerprint is cancelled', async () => {
    biometric.save.mockResolvedValue(false);

    expect(await service.enable(CREDENTIALS)).toBe(false);
    expect(service.isEnabled()).toBe(false);
  });

  it('signs in with the saved credentials', async () => {
    biometric.read.mockResolvedValue(CREDENTIALS);
    login.mockResolvedValue({ id: 'u1' });

    expect(await service.login()).toEqual({ id: 'u1' });
    expect(login).toHaveBeenCalledWith(CREDENTIALS);
  });

  it('does nothing when cancelled and turns off when the credentials are gone', async () => {
    biometric.save.mockResolvedValue(true);
    await service.enable(CREDENTIALS);

    biometric.read.mockResolvedValue('cancelled');
    expect(await service.login()).toBeNull();
    expect(service.isEnabled()).toBe(true);

    biometric.read.mockResolvedValue('missing');
    expect(await service.login()).toBeNull();
    expect(service.isEnabled()).toBe(false);
    expect(biometric.remove).toHaveBeenCalled();
  });

  it('turns off when the saved password no longer works, and keeps it for other errors', async () => {
    biometric.save.mockResolvedValue(true);
    await service.enable(CREDENTIALS);
    biometric.read.mockResolvedValue(CREDENTIALS);

    login.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0));
    await expect(service.login()).rejects.toBeInstanceOf(ApiError);
    expect(service.isEnabled()).toBe(true);

    login.mockRejectedValueOnce(new ApiError('INVALID_CREDENTIALS', 401));
    await expect(service.login()).rejects.toBeInstanceOf(ApiError);
    expect(service.isEnabled()).toBe(false);
  });
});
