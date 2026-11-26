import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { vi } from 'vitest';
import { BiometricPlugin, NATIVE_BIOMETRIC } from './biometric-plugin';

const TEXTS = { title: 'Huella', cancel: 'Cancelar' };
const CREDENTIALS = { email: 'ana@ual.es', password: 'secret-password' };

describe('BiometricPlugin', () => {
  let plugin: BiometricPlugin;
  // El plugin nativo, falso (ver NATIVE_BIOMETRIC)
  const native = {
    isAvailable: vi.fn(),
    setCredentials: vi.fn(),
    getSecureCredentials: vi.fn(),
    deleteCredentials: vi.fn(),
  };

  function onDevice(isNative: boolean): void {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(isNative);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: NATIVE_BIOMETRIC, useValue: native }],
    });
    plugin = TestBed.inject(BiometricPlugin);
  });

  afterEach(() => vi.restoreAllMocks());

  it('is never available on the web', async () => {
    onDevice(false);

    expect(await plugin.isAvailable()).toBe(false);
    expect(native.isAvailable).not.toHaveBeenCalled();
  });

  it('asks the device for strong biometrics on Android', async () => {
    onDevice(true);
    native.isAvailable.mockResolvedValue({ isAvailable: true });

    expect(await plugin.isAvailable()).toBe(true);
    expect(native.isAvailable).toHaveBeenCalledWith({ useFallback: false });
  });

  it('protects the saved credentials with the fingerprint', async () => {
    native.setCredentials.mockResolvedValue(undefined);

    expect(await plugin.save(CREDENTIALS, TEXTS)).toBe(true);
    expect(native.setCredentials).toHaveBeenCalledWith({
      server: 'carpooling-ual',
      username: 'ana@ual.es',
      password: 'secret-password',
      accessControl: 2,
      title: 'Huella',
      negativeButtonText: 'Cancelar',
    });
  });

  it('answers false when saving is cancelled and lets other errors through', async () => {
    native.setCredentials.mockRejectedValueOnce({ code: '16' });
    expect(await plugin.save(CREDENTIALS, TEXTS)).toBe(false);

    const failure = { code: 0, message: 'Keystore failed' };
    native.setCredentials.mockRejectedValueOnce(failure);
    await expect(plugin.save(CREDENTIALS, TEXTS)).rejects.toBe(failure);
  });

  it('reads the credentials after the fingerprint', async () => {
    native.getSecureCredentials.mockResolvedValue({
      username: 'ana@ual.es',
      password: 'secret-password',
    });

    expect(await plugin.read({ ...TEXTS, subtitle: 'ana@ual.es' })).toEqual(CREDENTIALS);
    expect(native.getSecureCredentials).toHaveBeenCalledWith({
      server: 'carpooling-ual',
      title: 'Huella',
      subtitle: 'ana@ual.es',
      negativeButtonText: 'Cancelar',
    });
  });

  it('tells a cancelled reading from credentials that are gone', async () => {
    native.getSecureCredentials.mockRejectedValueOnce({ code: 16 });
    expect(await plugin.read(TEXTS)).toBe('cancelled');

    native.getSecureCredentials.mockRejectedValueOnce({ code: '21' });
    expect(await plugin.read(TEXTS)).toBe('missing');

    native.getSecureCredentials.mockRejectedValueOnce(new Error('unexpected'));
    await expect(plugin.read(TEXTS)).rejects.toThrow('unexpected');

    native.getSecureCredentials.mockRejectedValueOnce({ code: { nested: true } });
    await expect(plugin.read(TEXTS)).rejects.toEqual({ code: { nested: true } });
  });

  it('removes the credentials only on the device', async () => {
    onDevice(false);
    await plugin.remove();
    expect(native.deleteCredentials).not.toHaveBeenCalled();

    onDevice(true);
    await plugin.remove();
    expect(native.deleteCredentials).toHaveBeenCalledWith({ server: 'carpooling-ual' });
  });
});
