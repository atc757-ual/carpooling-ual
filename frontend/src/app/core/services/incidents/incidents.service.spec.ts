import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { IncidentsService } from './incidents.service';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), IncidentsService],
    });
    service = TestBed.inject(IncidentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts a trip incident report and returns the created incident', async () => {
    const promise = service.reportTripIncident('t1', {
      category: 'technical',
      description: 'El coche se ha averiado en mitad del trayecto.',
    });

    const req = http.expectOne('/api/trips/t1/incidents');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      category: 'technical',
      description: 'El coche se ha averiado en mitad del trayecto.',
    });

    req.flush({
      id: 'inc-1',
      category: 'technical',
      description: 'El coche se ha averiado en mitad del trayecto.',
      reportedAt: '2026-11-02T20:00:00.000Z',
      status: 'open',
    });

    const res = await promise;
    expect(res.id).toBe('inc-1');
    expect(res.category).toBe('technical');
  });

  it('lists my incidents five at a time with the total', async () => {
    const promise = service.listMine(5);

    const req = http.expectOne((request) => request.url === '/api/users/me/incidents');
    expect(req.request.params.get('offset')).toBe('5');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush([{ id: 'inc-6' }], { headers: { 'X-Total-Count': '6' } });

    expect(await promise).toEqual({ items: [{ id: 'inc-6' }], total: 6 });
  });

  it('translates errors listing my incidents to ApiError', async () => {
    const promise = service.listMine(0);

    http
      .expectOne((request) => request.url === '/api/users/me/incidents')
      .flush({ code: 'INTERNAL_ERROR' }, { status: 500, statusText: 'Server Error' });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });

  it('translates http errors to ApiError', async () => {
    const promise = service.reportTripIncident('t1', {
      category: 'technical',
      description: 'El coche se ha averiado.',
    });

    const req = http.expectOne('/api/trips/t1/incidents');
    req.flush({ code: 'TRIP_NOT_IN_PROGRESS' }, { status: 409, statusText: 'Conflict' });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });

  it('reports a finished trip, and translates its errors', async () => {
    const payload = { category: 'other' as const, description: 'El conductor llegó tarde.' };
    const sent = service.reportAfterTrip('t1', payload);
    const req = http.expectOne('/api/trips/t1/incidents/after-trip');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'inc-2' });
    expect((await sent).id).toBe('inc-2');

    const late = service.reportAfterTrip('t1', payload);
    http
      .expectOne('/api/trips/t1/incidents/after-trip')
      .flush({ code: 'REPORT_WINDOW_CLOSED' }, { status: 409, statusText: 'Conflict' });
    await expect(late).rejects.toBeInstanceOf(ApiError);
  });
});
