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

  afterEach(() => {
    http.verify();
  });

  it('gets driver status', async () => {
    const status = driver.getStatus();
    const request = http.expectOne('/api/users/me/driver-status');
    expect(request.request.method).toBe('GET');
    request.flush({ hasLicenseDeclared: true, vehiclesCount: 1 });

    expect(await status).toEqual({ hasLicenseDeclared: true, vehiclesCount: 1 });
  });

  it('lists vehicles', async () => {
    const vehicles = driver.listVehicles();
    const request = http.expectOne('/api/vehicles');
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'v1' }]);

    expect(await vehicles).toEqual([{ id: 'v1' }]);
  });

  it('deactivates a vehicle', async () => {
    const deactivated = driver.deactivateVehicle('v1');
    const request = http.expectOne('/api/vehicles/v1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    await expect(deactivated).resolves.toBeUndefined();
  });

  it('starts and finishes a trip', async () => {
    const started = driver.startTrip('t1');
    const startRequest = http.expectOne('/api/trips/t1/start');
    expect(startRequest.request.method).toBe('POST');
    startRequest.flush({ id: 't1', status: 'in_progress' });

    const finished = driver.finishTrip('t1');
    const finishRequest = http.expectOne('/api/trips/t1/finish');
    expect(finishRequest.request.method).toBe('POST');
    finishRequest.flush({ id: 't1', status: 'finished' });

    expect(await started).toEqual({ id: 't1', status: 'in_progress' });
    expect(await finished).toEqual({ id: 't1', status: 'finished' });
  });

  it('gets publishing status and cancels a trip', async () => {
    const status = driver.getPublishingStatus();
    const statusRequest = http.expectOne('/api/users/me/publishing-status');
    expect(statusRequest.request.method).toBe('GET');
    statusRequest.flush({ lateCancellations: 2, publishingSuspendedUntil: null });

    const cancellation = driver.cancelTrip('t1');
    const cancelRequest = http.expectOne('/api/trips/t1/cancel');
    expect(cancelRequest.request.method).toBe('POST');
    expect(cancelRequest.request.body).toBeNull();
    cancelRequest.flush({ id: 't1', status: 'cancelled' });

    await expect(status).resolves.toEqual({
      lateCancellations: 2,
      publishingSuspendedUntil: null,
    });
    await expect(cancellation).resolves.toEqual({ id: 't1', status: 'cancelled' });
  });

  it('registers a vehicle and accepts the declaration', async () => {
    const vehicle = driver.registerVehicle({
      plate: '1234BCD',
      capacity: 3,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
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
    const updated = driver.updateVehicle('v1', { color: 'red' });
    const request = http.expectOne('/api/vehicles/v1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ color: 'red' });
    request.flush({ id: 'v1', color: 'red' });

    expect(await updated).toEqual({ id: 'v1', color: 'red' });
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

  it('boards a passenger and marks no-show', async () => {
    const boardedPromise = driver.boardPassenger('r1', '4821');
    const boardReq = http.expectOne('/api/requests/r1/board');
    expect(boardReq.request.method).toBe('POST');
    expect(boardReq.request.body).toEqual({ code: '4821' });
    boardReq.flush({ id: 'r1', boardedAt: '2026-11-03T10:00:00Z' });

    const noShowPromise = driver.markNoShow('r1');
    const noShowReq = http.expectOne('/api/requests/r1/no-show');
    expect(noShowReq.request.method).toBe('POST');
    expect(noShowReq.request.body).toBeNull();
    noShowReq.flush({ id: 'r1', status: 'cancelled', rejectionReason: 'no_show' });

    expect(await boardedPromise).toEqual({ id: 'r1', boardedAt: '2026-11-03T10:00:00Z' });
    expect(await noShowPromise).toEqual({ id: 'r1', status: 'cancelled', rejectionReason: 'no_show' });
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
