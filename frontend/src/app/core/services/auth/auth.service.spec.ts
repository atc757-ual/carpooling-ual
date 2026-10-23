import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiError, NETWORK_ERROR } from '../../models/api-error.model';
import { AccessToken } from '../../models/auth.model';
import { User } from '../../models/user.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from './auth.service';

const REFRESH_TOKEN_KEY = 'auth.refresh-token';

const USER: User = {
  '@type': 'User',
  id: 'user-1',
  href: '/api/users/user-1',
  name: 'Ana García',
  email: 'ana@ual.es',
  profiles: ['passenger'],
};

function accessToken(suffix: string): AccessToken {
  return {
    '@type': 'AccessToken',
    accessToken: `access-${suffix}`,
    tokenType: 'Bearer',
    expiresIn: 900,
    refreshToken: `refresh-${suffix}`,
    refreshTokenExpiresAt: '2026-11-01T00:00:00.000Z',
    user: USER,
  };
}

// Preferences en memoria (sin Capacitor)
class FakePreferences {
  readonly values = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let preferences: FakePreferences;

  // El servicio lee Preferences (asíncrono) antes de hacer la petición
  const expectRequest = (url: string): Promise<TestRequest> => vi.waitFor(() => http.expectOne(url));

  beforeEach(() => {
    preferences = new FakePreferences();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: PreferencesPlugin, useValue: preferences }],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  describe('login', () => {
    it('starts the session: user, access token in memory and refresh token stored', async () => {
      const login = auth.login({ email: 'ana@ual.es', password: 'secret' });
      const request = await expectRequest('/api/auth/login');
      expect(request.request.body).toEqual({ email: 'ana@ual.es', password: 'secret' });
      request.flush(accessToken('1'));

      await expect(login).resolves.toEqual(USER);
      expect(auth.isLoggedIn()).toBe(true);
      expect(auth.currentUser()).toEqual(USER);
      expect(auth.getAccessToken()).toBe('access-1');
      expect(preferences.values.get(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    });

    it('rejects with the API error and does not start a session', async () => {
      const login = auth.login({ email: 'ana@ual.es', password: 'wrong' });
      (await expectRequest('/api/auth/login')).flush(
        { code: 'INVALID_CREDENTIALS' },
        { status: 401, statusText: 'Unauthorized' },
      );

      await expect(login).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
      expect(auth.isLoggedIn()).toBe(false);
      expect(preferences.values.has(REFRESH_TOKEN_KEY)).toBe(false);
    });
  });

  it('registers the account without starting a session', async () => {
    const request = { name: 'Ana García', email: 'ana@ual.es', password: 'secret', profiles: ['passenger' as const] };
    const register = auth.register(request);
    const httpRequest = await expectRequest('/api/auth/register');
    expect(httpRequest.request.body).toEqual(request);
    httpRequest.flush(USER);

    await expect(register).resolves.toEqual(USER);
    expect(auth.isLoggedIn()).toBe(false);
  });

  describe('hasProfile', () => {
    it('is false without a session', () => {
      expect(auth.hasProfile('passenger')).toBe(false);
    });

    it('checks the profiles of the current user', async () => {
      const login = auth.login({ email: 'ana@ual.es', password: 'secret' });
      (await expectRequest('/api/auth/login')).flush(accessToken('1'));
      await login;

      expect(auth.hasProfile('passenger')).toBe(true);
      expect(auth.hasProfile('driver')).toBe(false);
    });
  });

  describe('logout', () => {
    it('ends the session and revokes the refresh token on the server', async () => {
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');
      const logout = auth.logout();
      const request = await expectRequest('/api/auth/logout');
      expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
      request.flush(null, { status: 204, statusText: 'No Content' });

      await logout;
      expect(auth.isLoggedIn()).toBe(false);
      expect(auth.getAccessToken()).toBeNull();
      expect(preferences.values.has(REFRESH_TOKEN_KEY)).toBe(false);
    });

    it('ends the local session even if the server cannot be reached', async () => {
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');
      const logout = auth.logout();
      (await expectRequest('/api/auth/logout')).error(new ProgressEvent('error'));

      await expect(logout).resolves.toBeUndefined();
      expect(preferences.values.has(REFRESH_TOKEN_KEY)).toBe(false);
    });

    it('does not call the server when there is no session', async () => {
      await auth.logout();

      expect(http.match('/api/auth/logout')).toHaveLength(0);
    });
  });

  describe('restoreSession', () => {
    it('does nothing when no refresh token is stored', async () => {
      await auth.restoreSession();

      expect(http.match('/api/auth/refresh')).toHaveLength(0);
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('renews the stored session, which brings the user', async () => {
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');
      const restore = auth.restoreSession();
      const request = await expectRequest('/api/auth/refresh');
      expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
      request.flush(accessToken('2'));

      await restore;
      expect(auth.currentUser()).toEqual(USER);
      expect(auth.getAccessToken()).toBe('access-2');
      expect(preferences.values.get(REFRESH_TOKEN_KEY)).toBe('refresh-2');
    });

    it('forgets a session that can no longer be renewed', async () => {
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');
      const restore = auth.restoreSession();
      (await expectRequest('/api/auth/refresh')).flush(
        { code: 'INVALID_REFRESH_TOKEN' },
        { status: 401, statusText: 'Unauthorized' },
      );

      await expect(restore).resolves.toBeUndefined();
      expect(auth.isLoggedIn()).toBe(false);
      expect(preferences.values.has(REFRESH_TOKEN_KEY)).toBe(false);
    });

    it('keeps the stored session when offline, to try again later', async () => {
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');
      const restore = auth.restoreSession();
      (await expectRequest('/api/auth/refresh')).error(new ProgressEvent('error'));

      await expect(restore).resolves.toBeUndefined();
      expect(auth.isLoggedIn()).toBe(false);
      expect(preferences.values.get(REFRESH_TOKEN_KEY)).toBe('refresh-1');
    });
  });

  describe('refreshAccessToken', () => {
    it('makes a single request for simultaneous calls', async () => {
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');
      const first = auth.refreshAccessToken();
      const second = auth.refreshAccessToken();
      (await expectRequest('/api/auth/refresh')).flush(accessToken('2'));

      await expect(first).resolves.toBe('access-2');
      await expect(second).resolves.toBe('access-2');
    });

    it('fails with INVALID_REFRESH_TOKEN when there is no stored session', async () => {
      await expect(auth.refreshAccessToken()).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      expect(http.match('/api/auth/refresh')).toHaveLength(0);
    });

    it('rejects with an ApiError when the server cannot be reached', async () => {
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');
      const refresh = auth.refreshAccessToken();
      (await expectRequest('/api/auth/refresh')).error(new ProgressEvent('error'));

      await expect(refresh).rejects.toBeInstanceOf(ApiError);
      await expect(refresh).rejects.toMatchObject({ code: NETWORK_ERROR });
    });

    it('takes turns with other tabs and uses the token stored by them', async () => {
      // Otra pestaña renovó mientras esta esperaba su turno: guardó refresh-2
      const request = vi.fn(async (_name: string, callback: () => Promise<string>) => {
        preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-2');
        return callback();
      });
      vi.stubGlobal('navigator', { locks: { request } });
      preferences.values.set(REFRESH_TOKEN_KEY, 'refresh-1');

      const refresh = auth.refreshAccessToken();
      const httpRequest = await expectRequest('/api/auth/refresh');
      expect(httpRequest.request.body).toEqual({ refreshToken: 'refresh-2' });
      httpRequest.flush(accessToken('3'));

      await expect(refresh).resolves.toBe('access-3');
      expect(request).toHaveBeenCalledWith('carpooling-ual.auth-refresh', expect.any(Function));
    });
  });
});
