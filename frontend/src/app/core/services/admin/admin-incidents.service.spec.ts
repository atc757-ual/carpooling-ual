import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminIncidentsService } from './admin-incidents.service';

describe('AdminIncidentsService', () => {
  let incidents: AdminIncidentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    incidents = TestBed.inject(AdminIncidentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('counts the open incidents and keeps the count if it fails', async () => {
    const refresh = incidents.refreshOpenCount();
    http
      .expectOne('/api/incidents?status=open&limit=1')
      .flush([], { headers: { 'X-Total-Count': '3' } });
    await refresh;
    expect(incidents.openCount()).toBe(3);

    const failing = incidents.refreshOpenCount();
    http
      .expectOne('/api/incidents?status=open&limit=1')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await failing;
    expect(incidents.openCount()).toBe(3);
  });

  it('counts none when the total is missing', async () => {
    const refresh = incidents.refreshOpenCount();
    http.expectOne('/api/incidents?status=open&limit=1').flush([]);
    await refresh;
    expect(incidents.openCount()).toBe(0);
  });

  it('lists with the filters in use, gets one and reviews it updating the count', async () => {
    const page = incidents.list({ status: 'open', category: 'driver', offset: 0, limit: 20 });
    http
      .expectOne('/api/incidents?offset=0&limit=20&status=open&category=driver')
      .flush([{ id: 'i1' }], { headers: { 'X-Total-Count': '7' } });
    expect(await page).toEqual({ items: [{ id: 'i1' }], total: 7 });

    const all = incidents.list({ offset: 20, limit: 20 });
    http.expectOne('/api/incidents?offset=20&limit=20').flush([]);
    expect((await all).total).toBe(0);

    const one = incidents.get('i1');
    http.expectOne('/api/incidents/i1').flush({ id: 'i1' });
    expect(await one).toEqual({ id: 'i1' });

    const review = incidents.review('i1', 'Talked to both of them');
    const post = http.expectOne('/api/incidents/i1/review');
    expect(post.request.body).toEqual({ resolution: 'Talked to both of them' });
    post.flush({ id: 'i1', status: 'reviewed' });
    expect(await review).toEqual({ id: 'i1', status: 'reviewed' });
    http
      .expectOne('/api/incidents?status=open&limit=1')
      .flush([], { headers: { 'X-Total-Count': '2' } });
    await Promise.resolve();
    expect(incidents.openCount()).toBe(2);
  });

  it('starts and leaves the review, updating the count', async () => {
    const started = incidents.startReview('i1');
    const start = http.expectOne('/api/incidents/i1/review/start');
    expect(start.request.method).toBe('POST');
    start.flush({ id: 'i1', status: 'in_review' });
    expect(await started).toEqual({ id: 'i1', status: 'in_review' });
    http
      .expectOne('/api/incidents?status=open&limit=1')
      .flush([], { headers: { 'X-Total-Count': '1' } });

    const released = incidents.releaseReview('i1');
    http.expectOne('/api/incidents/i1/review/release').flush({ id: 'i1', status: 'open' });
    expect(await released).toEqual({ id: 'i1', status: 'open' });
    http
      .expectOne('/api/incidents?status=open&limit=1')
      .flush([], { headers: { 'X-Total-Count': '2' } });
    await Promise.resolve();
    expect(incidents.openCount()).toBe(2);
  });

  it('throws an ApiError when a request fails', async () => {
    const one = incidents.get('missing');
    http
      .expectOne('/api/incidents/missing')
      .flush({ code: 'INCIDENT_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await expect(one).rejects.toBeInstanceOf(ApiError);
  });
});
