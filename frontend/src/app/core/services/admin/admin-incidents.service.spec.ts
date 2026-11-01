import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
});
