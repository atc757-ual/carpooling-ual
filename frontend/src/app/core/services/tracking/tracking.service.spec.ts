import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { TripPosition } from '../../models/trip-position.model';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let tracking: TrackingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    tracking = TestBed.inject(TrackingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the latest position for a trip', async () => {
    const position: TripPosition = {
      tripId: 't1',
      position: { type: 'Point', coordinates: [-2.46, 36.84] },
      recordedAt: '2026-11-01T20:00:00.000Z',
      remainingKm: 1.2,
      remainingMin: 3,
      remainingSource: 'estimated',
      estimatedArrivalAt: '2026-11-01T20:03:00.000Z',
    };
    const result = tracking.getLatest('t1');
    http.expectOne('/api/trips/t1/position').flush(position);

    await expect(result).resolves.toEqual(position);
  });

  it('converts API errors to ApiError', async () => {
    const result = tracking.getLatest('t1');
    http
      .expectOne('/api/trips/t1/position')
      .flush(
        { '@type': 'Error', code: 'POSITION_NOT_FOUND', status: '404' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(result).rejects.toBeInstanceOf(ApiError);
  });
});
