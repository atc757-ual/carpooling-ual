import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  let trips: TripsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    trips = TestBed.inject(TripsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets a trip', async () => {
    const trip = trips.getTrip('t1');
    http.expectOne('/api/trips/t1').flush({ id: 't1' });

    expect(await trip).toEqual({ id: 't1' });
  });

  it('turns API errors into ApiError', async () => {
    const trip = trips.getTrip('t1');
    http
      .expectOne('/api/trips/t1')
      .flush(
        { '@type': 'Error', code: 'TRIP_NOT_FOUND', status: '404' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(trip).rejects.toBeInstanceOf(ApiError);
  });
});
