import { TestBed } from '@angular/core/testing';
import { PreferencesPlugin } from './preferences-plugin';

// En los tests se ejecuta la implementación web de Capacitor (localStorage)
describe('PreferencesPlugin', () => {
  let preferences: PreferencesPlugin;

  beforeEach(() => {
    localStorage.clear();
    preferences = TestBed.inject(PreferencesPlugin);
  });

  it('stores, reads and removes a value', async () => {
    await preferences.set('auth.refresh-token', 'token-1');
    expect(await preferences.get('auth.refresh-token')).toBe('token-1');

    await preferences.remove('auth.refresh-token');
    expect(await preferences.get('auth.refresh-token')).toBeNull();
  });

  it('returns null for a key that was never stored', async () => {
    expect(await preferences.get('missing')).toBeNull();
  });
});
