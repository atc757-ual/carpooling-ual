import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { TripSearchRequest } from '../../models/trip-match.model';
import { MatchingService } from './matching.service';

const REQUEST: TripSearchRequest = {
  place: { type: 'Point', coordinates: [-2.6, 36.76] },
  parkingId: 'p1',
  direction: 'to-campus',
  desiredAt: '2026-10-28T07:00:00.000Z',
  marginMin: 20,
  seats: 1,
};

describe('MatchingService', () => {
  let matching: MatchingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    matching = TestBed.inject(MatchingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the search and returns the compatible trips', async () => {
    const result = matching.search(REQUEST);
    const request = http.expectOne('/api/trips/search');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(REQUEST);
    request.flush([{ id: 't1' }]);

    expect(await result).toEqual([{ id: 't1' }]);
  });

  it('turns API errors into ApiError', async () => {
    const result = matching.search(REQUEST);
    http
      .expectOne('/api/trips/search')
      .flush(
        { '@type': 'Error', code: 'CAMPUS_PARKING_NOT_FOUND', status: '404' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});
