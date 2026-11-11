import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { TripReviewsService } from './trip-reviews.service';

describe('TripReviewsService', () => {
  let service: TripReviewsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TripReviewsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reviews someone of a trip', async () => {
    const created = service.create('t1', { targetId: 'd1', rating: 5, comment: null });
    const request = http.expectOne('/api/trips/t1/reviews');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ targetId: 'd1', rating: 5, comment: null });
    request.flush({ id: 'rev1' });

    expect(await created).toEqual({ id: 'rev1' });
  });

  it('lists the reviews given to a role and the trips still to review', async () => {
    const given = service.listGiven('driver');
    const list = http.expectOne((req) => req.url === '/api/users/me/reviews');
    expect(list.request.params.get('direction')).toBe('given');
    expect(list.request.params.get('role')).toBe('driver');
    list.flush([]);
    expect(await given).toEqual([]);

    const pending = service.listPending();
    http.expectOne('/api/users/me/pending-reviews').flush([]);
    expect(await pending).toEqual([]);
  });

  it('turns the API errors into ApiError', async () => {
    const created = service.create('t1', { targetId: 'd1', rating: 1 });
    http.expectOne('/api/trips/t1/reviews').flush(
      {
        '@type': 'Error',
        code: 'REVIEW_ALREADY_EXISTS',
        reason: 'x',
        message: 'x',
        status: '409',
      },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(created).rejects.toBeInstanceOf(ApiError);
    const given = service.listGiven('passenger');
    http.expectOne((req) => req.url === '/api/users/me/reviews').error(new ProgressEvent('x'));
    await expect(given).rejects.toBeInstanceOf(ApiError);
    const pending = service.listPending();
    http.expectOne('/api/users/me/pending-reviews').error(new ProgressEvent('x'));
    await expect(pending).rejects.toBeInstanceOf(ApiError);
  });
});
