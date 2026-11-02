import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminOverviewService } from './admin-overview.service';

describe('AdminOverviewService', () => {
  let overview: AdminOverviewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    overview = TestBed.inject(AdminOverviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the live overview', async () => {
    const request = overview.overview();
    http.expectOne('/api/admin/overview').flush({ tripsPublishedToday: 4 });
    await expect(request).resolves.toEqual({ tripsPublishedToday: 4 });
  });

  it('lists a page of events of one type with the total', async () => {
    const request = overview.listEvents({ type: 'trip.published', offset: 20, limit: 20 });
    http
      .expectOne('/api/admin/events?offset=20&limit=20&type=trip.published')
      .flush([{ id: 'e1' }], { headers: { 'X-Total-Count': '41' } });
    await expect(request).resolves.toEqual({ items: [{ id: 'e1' }], total: 41 });
  });

  it('counts the items when the total is missing', async () => {
    const request = overview.listEvents({ offset: 0, limit: 20 });
    http.expectOne('/api/admin/events?offset=0&limit=20').flush([{ id: 'e1' }]);
    await expect(request).resolves.toEqual({ items: [{ id: 'e1' }], total: 1 });
  });

  it('gets an event and turns errors into ApiError', async () => {
    const found = overview.getEvent('e1');
    http.expectOne('/api/admin/events/e1').flush({ id: 'e1', payload: {} });
    await expect(found).resolves.toEqual({ id: 'e1', payload: {} });

    const missing = overview.getEvent('e2');
    http
      .expectOne('/api/admin/events/e2')
      .flush({ code: 'EVENT_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await expect(missing).rejects.toBeInstanceOf(ApiError);
  });
});
