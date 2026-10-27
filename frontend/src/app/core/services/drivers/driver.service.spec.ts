import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { PublishTripRequest } from '../../models/driver.model';
import { DriverService } from './driver.service';

const TRIP: PublishTripRequest = {
  vehicleId: 'v1',
  origin: { type: 'Point', coordinates: [-2.6, 36.76] },
  destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  departureAt: '2026-10-28T06:40:00.000Z',
  offeredSeats: 2,
  maxDetourMin: 10,
};

describe('DriverService', () => {
  let driver: DriverService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    driver = TestBed.inject(DriverService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the driver status and the vehicles', async () => {
    const status = driver.getStatus();
    http.expectOne('/api/users/me/driver-status').flush({ isReady: false });
    const vehicles = driver.listVehicles();
    http.expectOne('/api/vehicles').flush([]);

    expect(await status).toEqual({ isReady: false });
    expect(await vehicles).toEqual([]);
  });

  it('registers a vehicle and accepts the declaration', async () => {
    const vehicle = driver.registerVehicle({ plate: '1234BCD', capacity: 3 });
    const request = http.expectOne('/api/vehicles');
    expect(request.request.method).toBe('POST');
    request.flush({ id: 'v1' });
    const declaration = driver.acceptDeclaration();
    const declarationRequest = http.expectOne('/api/users/me/driver-declaration');
    expect(declarationRequest.request.method).toBe('PUT');
    declarationRequest.flush({ hasLicenseDeclared: true });

    expect(await vehicle).toEqual({ id: 'v1' });
    expect(await declaration).toEqual({ hasLicenseDeclared: true });
  });

  it('publishes a trip and turns API errors into ApiError', async () => {
    const published = driver.publishTrip(TRIP);
    const request = http.expectOne('/api/trips');
    expect(request.request.body).toEqual(TRIP);
    request.flush(
      { '@type': 'Error', code: 'DEPARTURE_IN_THE_PAST', status: '400' },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(published).rejects.toBeInstanceOf(ApiError);
  });
});
