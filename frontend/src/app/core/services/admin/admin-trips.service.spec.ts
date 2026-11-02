import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminTripsService } from './admin-trips.service';

describe('AdminTripsService', () => {
  let trips: AdminTripsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    trips = TestBed.inject(AdminTripsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends only the filters with a value and reads the total', async () => {
    const page = trips.list({
      driver: 'javier',
      status: 'confirmed',
      from: '2026-11-02',
      to: undefined,
      offset: 20,
      limit: 20,
    });
    http
      .expectOne(
        '/api/admin/trips?offset=20&limit=20&driver=javier&status=confirmed&from=2026-11-02',
      )
      .flush([{ id: 't1' }], { headers: { 'X-Total-Count': '41' } });
    await expect(page).resolves.toEqual({ items: [{ id: 't1' }], total: 41 });
  });

  it('counts the items without a total and turns errors into ApiError', async () => {
    const page = trips.list({ offset: 0, limit: 20 });
    http.expectOne('/api/admin/trips?offset=0&limit=20').flush([{ id: 't1' }]);
    await expect(page).resolves.toEqual({ items: [{ id: 't1' }], total: 1 });

    const failing = trips.list({ offset: 0, limit: 20 });
    http
      .expectOne('/api/admin/trips?offset=0&limit=20')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await expect(failing).rejects.toBeInstanceOf(ApiError);
  });
});
