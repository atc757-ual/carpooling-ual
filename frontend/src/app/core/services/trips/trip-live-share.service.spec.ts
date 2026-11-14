import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ApiError } from '../../models/api-error.model';
import { SharedTrip } from '../../models/trip-share.model';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { TripLiveShareService } from './trip-live-share.service';

const TOKEN = 'a'.repeat(43);

describe('TripLiveShareService', () => {
  let service: TripLiveShareService;
  let http: HttpTestingController;
  const preferences = {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PreferencesPlugin, useValue: preferences },
      ],
    });
    service = TestBed.inject(TripLiveShareService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates the link and remembers its full address', async () => {
    const result = service.start('t1');
    const request = http.expectOne('/api/trips/t1/share');
    expect(request.request.method).toBe('POST');
    request.flush({ id: 's1', tripId: 't1', token: TOKEN, url: `/seguir/${TOKEN}` });

    const url = `${globalThis.location.origin}/seguir/${TOKEN}`;
    await expect(result).resolves.toBe(url);
    expect(preferences.set).toHaveBeenCalledWith('trip-live-share:t1', url);
  });

  it('stops sharing and forgets the link', async () => {
    const result = service.stop('t1');
    const request = http.expectOne('/api/trips/t1/share');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await result;
    expect(preferences.remove).toHaveBeenCalledWith('trip-live-share:t1');
  });

  it('reads the remembered link', async () => {
    preferences.get.mockResolvedValue('https://app/seguir/x');

    await expect(service.getActiveLink('t1')).resolves.toBe('https://app/seguir/x');
    expect(preferences.get).toHaveBeenCalledWith('trip-live-share:t1');
  });

  it('gets the shared trip', async () => {
    const shared = { id: 's1', tripStatus: 'confirmed' } as SharedTrip;
    const result = service.getShared(TOKEN);
    http.expectOne(`/api/shares/${TOKEN}`).flush(shared);

    await expect(result).resolves.toEqual(shared);
  });

  it('converts API errors to ApiError', async () => {
    const result = service.getShared(TOKEN);
    http
      .expectOne(`/api/shares/${TOKEN}`)
      .flush(
        { '@type': 'Error', code: 'SHARE_NOT_FOUND', reason: 'x', message: 'x', status: '404' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(result).rejects.toMatchObject({ code: 'SHARE_NOT_FOUND' });
    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});
