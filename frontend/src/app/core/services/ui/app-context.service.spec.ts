import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Profile } from '../../models/user.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';
import { AppContextService, canUseApp, entryPathFor } from './app-context.service';

describe('entryPathFor', () => {
  it('sends users without the admin profile to the app', () => {
    expect(entryPathFor(['passenger'], 'admin')).toBe('/tabs');
  });

  it('sends an admin without other profiles to the panel', () => {
    expect(entryPathFor(['admin'], null)).toBe('/admin');
    expect(entryPathFor(['admin'], 'app')).toBe('/admin');
  });

  it('sends an admin who also drives to the last part used, the app the first time', () => {
    expect(entryPathFor(['driver', 'admin'], null)).toBe('/tabs');
    expect(entryPathFor(['driver', 'admin'], 'app')).toBe('/tabs');
    expect(entryPathFor(['driver', 'admin'], 'admin')).toBe('/admin');
  });

  it('tells whether the account can use the app', () => {
    expect(canUseApp(['admin'])).toBe(false);
    expect(canUseApp(['passenger', 'admin'])).toBe(true);
  });
});

describe('AppContextService', () => {
  const profiles = signal<Profile[]>(['passenger', 'admin']);
  const stored = new Map<string, string>();
  const preferences = {
    get: vi.fn((key: string) => Promise.resolve(stored.get(key) ?? null)),
    set: vi.fn((key: string, value: string) => {
      stored.set(key, value);
      return Promise.resolve();
    }),
  };

  function service(): AppContextService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: () => ({ profiles: profiles() }) } },
        { provide: PreferencesPlugin, useValue: preferences },
      ],
    });
    return TestBed.inject(AppContextService);
  }

  beforeEach(() => stored.clear());

  it('remembers the last part used and enters it after logging in', async () => {
    const appContext = service();
    expect(await appContext.entryPath()).toBe('/tabs');

    await appContext.remember('admin');

    expect(await appContext.entryPath()).toBe('/admin');
  });

  it('ignores an unknown stored value and storage errors', async () => {
    stored.set('app.last-context', 'garbage');
    const appContext = service();
    expect(await appContext.entryPath()).toBe('/tabs');

    preferences.get.mockRejectedValueOnce(new Error('blocked'));
    preferences.set.mockRejectedValueOnce(new Error('blocked'));
    await appContext.remember('admin');
    expect(await appContext.entryPath()).toBe('/tabs');
  });
});
