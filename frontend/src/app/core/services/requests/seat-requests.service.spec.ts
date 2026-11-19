import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import { SeatRequestsService } from './seat-requests.service';

describe('SeatRequestsService', () => {
  let requests: SeatRequestsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'me' }) } },
      ],
    });
    requests = TestBed.inject(SeatRequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the seats of a trip', async () => {
    const created = requests.request('t1', 2);
    const request = http.expectOne('/api/trips/t1/requests');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ seats: 2 });
    request.flush({ id: 'r1', status: 'pending' });

    expect(await created).toEqual({ id: 'r1', status: 'pending' });
  });

  it('gets one of my requests by its id, and not a request of someone else', async () => {
    const mine = requests.getMine('r1');
    http.expectOne('/api/requests/r1').flush({ id: 'r1', passenger: { id: 'me' } });
    expect(await mine).toEqual({ id: 'r1', passenger: { id: 'me' } });

    const other = requests.getMine('r2');
    http.expectOne('/api/requests/r2').flush({ id: 'r2', passenger: { id: 'someone' } });
    await expect(other).rejects.toMatchObject({ code: 'REQUEST_NOT_FOUND', status: 404 });
  });

  it('lists my requests and cancels one', async () => {
    const mine = requests.listMine();
    http.expectOne('/api/users/me/requests?limit=100').flush([{ id: 'r1' }]);
    const cancelled = requests.cancel('r1');
    const cancel = http.expectOne('/api/requests/r1/cancel');
    expect(cancel.request.method).toBe('POST');
    cancel.flush({ id: 'r1', status: 'cancelled' });

    expect(await mine).toEqual([{ id: 'r1' }]);
    expect(await cancelled).toEqual({ id: 'r1', status: 'cancelled' });
  });

  it('turns API errors into ApiError', async () => {
    const created = requests.request('t1', 1);
    http
      .expectOne('/api/trips/t1/requests')
      .flush(
        { '@type': 'Error', code: 'TRIP_FULL', status: '409' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(created).rejects.toBeInstanceOf(ApiError);
  });
});
