import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Profile } from '../../models/user.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';
import { ActiveModeService } from './active-mode.service';

const ACTIVE_MODE_KEY = 'users.active-mode';

describe('ActiveModeService', () => {
  const profiles = signal<Profile[]>([]);
  let stored: Map<string, string>;

  function create(storedMode?: string): ActiveModeService {
    stored = new Map(storedMode ? [[ACTIVE_MODE_KEY, storedMode]] : []);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { hasProfile: (profile: Profile) => profiles().includes(profile) },
        },
        {
          provide: PreferencesPlugin,
          useValue: {
            get: (key: string) => Promise.resolve(stored.get(key) ?? null),
            set: (key: string, value: string) => Promise.resolve(void stored.set(key, value)),
          },
        },
      ],
    });
    return TestBed.inject(ActiveModeService);
  }

  // Espera a que llegue lo guardado en el dispositivo
  const settle = (): Promise<void> => vi.waitFor(() => Promise.resolve());

  it('has no mode without the passenger or driver profile', () => {
    profiles.set([]);

    const service = create();

    expect(service.mode()).toBeNull();
    expect(service.hasBothModes()).toBe(false);
  });

  it('uses the only profile there is', () => {
    profiles.set(['driver']);

    expect(create().mode()).toBe('driver');
  });

  it('starts as a passenger with both profiles', () => {
    profiles.set(['passenger', 'driver']);

    const service = create();

    expect(service.mode()).toBe('passenger');
    expect(service.hasBothModes()).toBe(true);
  });

  it('changes the mode and remembers it on this device', async () => {
    profiles.set(['passenger', 'driver']);
    const service = create();

    await service.setMode('driver');

    expect(service.mode()).toBe('driver');
    expect(stored.get(ACTIVE_MODE_KEY)).toBe('driver');
  });

  it('restores the mode chosen last time', async () => {
    profiles.set(['passenger', 'driver']);

    const service = create('driver');
    await settle();

    expect(service.mode()).toBe('driver');
  });

  it('ignores a stored mode the user no longer has', async () => {
    profiles.set(['passenger']);

    const service = create('driver');
    await settle();

    expect(service.mode()).toBe('passenger');
  });
});
