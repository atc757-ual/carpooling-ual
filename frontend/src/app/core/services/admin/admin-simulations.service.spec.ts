import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminSimulationsService } from './admin-simulations.service';

describe('AdminSimulationsService', () => {
  let simulations: AdminSimulationsService;
  let http: HttpTestingController;
  const base = '/api/admin/simulations';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    simulations = TestBed.inject(AdminSimulationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the scenarios, the runs and one run with its results', async () => {
    const scenarios = simulations.scenarios();
    http.expectOne(`${base}/scenarios`).flush([{ code: 'S0' }]);
    expect(await scenarios).toEqual([{ code: 'S0' }]);

    const page = simulations.list({ offset: 0, limit: 10 });
    http
      .expectOne(`${base}?offset=0&limit=10`)
      .flush([{ id: 'r1' }], { headers: { 'X-Total-Count': '4' } });
    expect(await page).toEqual({ items: [{ id: 'r1' }], total: 4 });

    const run = simulations.get('r1');
    http.expectOne(`${base}/r1`).flush({ id: 'r1' });
    expect(await run).toEqual({ id: 'r1' });

    const results = simulations.results('r1');
    http.expectOne(`${base}/r1/results`).flush({ replicas: 30 });
    expect(await results).toEqual({ replicas: 30 });
  });

  it('starts, cancels and downloads the CSV', async () => {
    const start = simulations.start({ scenario: 'S1', replicas: 5, seed: 7 });
    const post = http.expectOne(base);
    expect(post.request.body).toEqual({ scenario: 'S1', replicas: 5, seed: 7 });
    post.flush({ id: 'r1' });
    expect(await start).toEqual({ id: 'r1' });

    const cancel = simulations.cancel('r1');
    http.expectOne(`${base}/r1/cancel`).flush({ id: 'r1', status: 'cancelled' });
    expect((await cancel).status).toBe('cancelled');

    const csv = simulations.csv('r1');
    const download = http.expectOne(`${base}/r1/results.csv`);
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['replica\n1']));
    expect(await csv).toBeInstanceOf(Blob);
  });

  it('throws an ApiError when a request fails', async () => {
    const start = simulations.start({ scenario: 'S1', seed: 7 });
    http
      .expectOne(base)
      .flush({ code: 'SIMULATION_ALREADY_RUNNING' }, { status: 409, statusText: 'Conflict' });
    await expect(start).rejects.toBeInstanceOf(ApiError);
  });
});
