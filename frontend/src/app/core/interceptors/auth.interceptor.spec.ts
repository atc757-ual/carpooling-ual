import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { ApiError, NETWORK_ERROR } from '../models/api-error.model';
import { AuthService } from '../services/auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  const auth = {
    getAccessToken: vi.fn<() => string | null>(),
    refreshAccessToken: vi.fn<() => Promise<string>>(),
  };

  // La petición repetida llega tras la renovación (una promesa)
  const expectRequest = (url: string): Promise<TestRequest> => vi.waitFor(() => httpMock.expectOne(url));
  const expired = { code: 'ACCESS_TOKEN_EXPIRED' };
  const unauthorized = { status: 401, statusText: 'Unauthorized' };

  beforeEach(() => {
    auth.getAccessToken.mockReset().mockReturnValue('access-1');
    auth.refreshAccessToken.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => httpMock.verify());

  describe('access token', () => {
    it('is sent to the API', () => {
      http.get('/api/trips').subscribe();

      expect(httpMock.expectOne('/api/trips').request.headers.get('Authorization')).toBe('Bearer access-1');
    });

    it('is sent to /api/auth/me', () => {
      http.get('/api/auth/me').subscribe();

      expect(httpMock.expectOne('/api/auth/me').request.headers.has('Authorization')).toBe(true);
    });

    it.each(['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'])(
      'is not sent to the public route %s',
      (url) => {
        http.post(url, {}).subscribe();

        expect(httpMock.expectOne(url).request.headers.has('Authorization')).toBe(false);
      },
    );

    it('is not sent outside the API', () => {
      http.get('https://tiles.example.org/1/2/3.png').subscribe();

      expect(httpMock.expectOne('https://tiles.example.org/1/2/3.png').request.headers.has('Authorization')).toBe(false);
    });

    it('is not sent when there is no session', () => {
      auth.getAccessToken.mockReturnValue(null);
      http.get('/api/trips').subscribe();

      expect(httpMock.expectOne('/api/trips').request.headers.has('Authorization')).toBe(false);
    });
  });

  describe('expired access token', () => {
    it('renews it and repeats the request once with the new token', async () => {
      auth.refreshAccessToken.mockResolvedValue('access-2');
      const response = firstValueFrom(http.get('/api/trips'));

      httpMock.expectOne('/api/trips').flush(expired, unauthorized);
      const retry = await expectRequest('/api/trips');
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
      retry.flush([{ id: 'trip-1' }]);

      await expect(response).resolves.toEqual([{ id: 'trip-1' }]);
      expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it('goes to the login, back to the current page afterwards, when the session cannot be renewed', async () => {
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      auth.refreshAccessToken.mockRejectedValue(new ApiError('INVALID_REFRESH_TOKEN', 401));
      const response = firstValueFrom(http.get('/api/trips'));

      httpMock.expectOne('/api/trips').flush(expired, unauthorized);

      await expect(response).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { returnUrl: '/' } });
    });

    it('stays on the page when the renewal fails for another reason (e.g. offline)', async () => {
      const navigate = vi.spyOn(router, 'navigate');
      auth.refreshAccessToken.mockRejectedValue(new ApiError(NETWORK_ERROR, 0));
      const response = firstValueFrom(http.get('/api/trips'));

      httpMock.expectOne('/api/trips').flush(expired, unauthorized);

      await expect(response).rejects.toMatchObject({ code: NETWORK_ERROR });
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('lets other errors through without renewing', async () => {
    const response = firstValueFrom(http.get('/api/users/user-2'));

    httpMock.expectOne('/api/users/user-2').flush({ code: 'PROFILE_REQUIRED' }, { status: 403, statusText: 'Forbidden' });

    await expect(response).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });
});
