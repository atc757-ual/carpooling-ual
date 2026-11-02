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

  it('translates http errors to ApiError', async () => {
    const promise = service.reportTripIncident('t1', {
      category: 'technical',
      description: 'El coche se ha averiado.',
    });

    const req = http.expectOne('/api/trips/t1/incidents');
    req.flush({ code: 'TRIP_NOT_IN_PROGRESS' }, { status: 409, statusText: 'Conflict' });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
  });
});

