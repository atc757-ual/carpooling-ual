import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminSimulationSweepsService } from './admin-simulation-sweeps.service';

describe('AdminSimulationSweepsService', () => {
  let sweeps: AdminSimulationSweepsService;
  let http: HttpTestingController;
  const base = '/api/admin/simulation-sweeps';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    sweeps = TestBed.inject(AdminSimulationSweepsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('starts a sweep and reads it back', async () => {
    const body = {
      scenario: 'S1',
      seed: 7,
      parameter: 'ownCarShare' as const,
      values: [0.2, 0.5],
    };
    const started = sweeps.start(body);
    const request = http.expectOne(base);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({ id: 'w1' });
    expect(await started).toEqual({ id: 'w1' });

    const sweep = sweeps.get('w1');
    http.expectOne(`${base}/w1`).flush({ id: 'w1' });
    expect(await sweep).toEqual({ id: 'w1' });
  });

  it('gives the latest sweep, or null when there is none', async () => {
    const latest = sweeps.latest();
    http.expectOne(`${base}?offset=0&limit=1`).flush([{ id: 'w2' }]);
    expect(await latest).toEqual({ id: 'w2' });

    const none = sweeps.latest();
    http.expectOne(`${base}?offset=0&limit=1`).flush([]);
    expect(await none).toBeNull();
  });

  it('turns the API errors into ApiError', async () => {
    const started = sweeps.start({
      scenario: 'S1',
      seed: 1,
      parameter: 'adoptionRate',
      values: [0.1, 0.3],
    });
    http
      .expectOne(base)
      .flush(
        { code: 'SIMULATION_ALREADY_RUNNING', status: '409' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(started).rejects.toBeInstanceOf(ApiError);
  });
});
