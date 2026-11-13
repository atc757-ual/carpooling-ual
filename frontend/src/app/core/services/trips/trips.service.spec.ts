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

  it('gets a trip route', async () => {
    const route = trips.getRoute('t1');
    const response = {
      tripId: 't1',
      distanceKm: 12,
      durationMin: 32,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-2.5, 36.8],
          [-2.4, 36.83],
        ],
      },
      source: 'osrm',
      tripStatus: 'published',
      startedAt: null,
      estimatedArrivalAt: '2026-10-27T08:12:00.000Z',
    };
    http.expectOne('/api/trips/t1/route').flush(response);

    expect(await route).toEqual(response);
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

  it('turns route API errors into ApiError', async () => {
    const route = trips.getRoute('t1');
    http
      .expectOne('/api/trips/t1/route')
      .flush(
        { '@type': 'Error', code: 'TRIP_NOT_FOUND', status: '404' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(route).rejects.toBeInstanceOf(ApiError);
  });

  it('plans a route preview between origin and destination', async () => {
    const plan = trips.planRoute([-2.5, 36.8], [-2.4, 36.83]);
    const response = {
      distanceKm: 15.5,
      durationMin: 20,
      geometry: {
        type: 'LineString' as const,
        coordinates: [[-2.5, 36.8] as [number, number], [-2.4, 36.83] as [number, number]],
      },
      source: 'osrm' as const,
    };
    const req = http.expectOne('/api/trips/plan');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      origin: { type: 'Point', coordinates: [-2.5, 36.8] },
      destination: { type: 'Point', coordinates: [-2.4, 36.83] },
    });
    req.flush(response);

    const result = await plan;
    expect(result).toEqual({
      tripId: 'preview',
      distanceKm: 15.5,
      durationMin: 20,
      geometry: response.geometry,
      source: 'osrm',
      tripStatus: 'published',
      startedAt: null,
      estimatedArrivalAt: null,
    });
  });

  it('turns planRoute API errors into ApiError', async () => {
    const plan = trips.planRoute([-2.5, 36.8], [-2.4, 36.83]);
    http
      .expectOne('/api/trips/plan')
      .flush(
        { '@type': 'Error', code: 'INVALID_LOCATION', status: '400' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(plan).rejects.toBeInstanceOf(ApiError);
  });
});
