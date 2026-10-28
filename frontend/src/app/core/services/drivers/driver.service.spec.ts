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
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1',
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

  it('deactivates a vehicle with DELETE', async () => {
    const removal = driver.deactivateVehicle('v1');
    const request = http.expectOne('/api/vehicles/v1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(removal).resolves.toBeUndefined();
  });

  it('gets the driver status and the vehicles', async () => {
    const status = driver.getStatus();
    http.expectOne('/api/users/me/driver-status').flush({ isReady: false });
    const vehicles = driver.listVehicles();
    http.expectOne('/api/vehicles').flush([]);

    expect(await status).toEqual({ isReady: false });
    expect(await vehicles).toEqual([]);
  });

  it('registers a vehicle and accepts the declaration', async () => {
    const vehicle = driver.registerVehicle({ plate: '1234BCD', capacity: 3, model: 'Seat Ibiza' });
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

  it('edits a vehicle with PATCH', async () => {
    const updated = driver.updateVehicle('v1', { model: 'Seat León' });
    const request = http.expectOne('/api/vehicles/v1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ model: 'Seat León' });
    request.flush({ id: 'v1', model: 'Seat León' });

    expect(await updated).toEqual({ id: 'v1', model: 'Seat León' });
  });

  it('lists my trips and the requests of one, and decides a request', async () => {
    const trips = driver.listMyTrips();
    http.expectOne('/api/users/me/trips?limit=100').flush([{ id: 't1' }]);
    const requests = driver.listTripRequests('t1');
    http.expectOne('/api/trips/t1/requests').flush([{ id: 'r1' }]);
    const accepted = driver.decideRequest('r1', 'accept');
    const decision = http.expectOne('/api/requests/r1/accept');
    expect(decision.request.method).toBe('POST');
    decision.flush({ id: 'r1', status: 'accepted' });

    expect(await trips).toEqual([{ id: 't1' }]);
    expect(await requests).toEqual([{ id: 'r1' }]);
    expect(await accepted).toEqual({ id: 'r1', status: 'accepted' });
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
