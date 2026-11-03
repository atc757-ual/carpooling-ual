import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { DriverReviewsService } from './driver-reviews.service';

describe('DriverReviewsService', () => {
  let service: DriverReviewsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DriverReviewsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the rating summary of the driver', async () => {
    const loading = service.getRating('driver-1');
    const rating = { average: 4.4, count: 5, distribution: [] };
    http.expectOne('/api/users/driver-1/driver-rating').flush(rating);

    await expect(loading).resolves.toEqual(rating);
  });

  it('lists a page of reviews with the total from X-Total-Count', async () => {
    const loading = service.list('driver-1', 10, 10);
    const request = http.expectOne((req) => req.url === '/api/users/driver-1/driver-reviews');
    expect(request.request.params.get('offset')).toBe('10');
    expect(request.request.params.get('limit')).toBe('10');
    request.flush([{ id: 'r1' }], { headers: { 'X-Total-Count': '11' } });

    await expect(loading).resolves.toEqual({ items: [{ id: 'r1' }], total: 11 });
  });

  it('counts the page when there is no X-Total-Count', async () => {
    const loading = service.list('driver-1', 0, 10);
    http.expectOne((req) => req.url === '/api/users/driver-1/driver-reviews').flush(null);

    await expect(loading).resolves.toEqual({ items: [], total: 0 });
  });

  it('throws an ApiError when a request fails', async () => {
    const rating = service.getRating('driver-1');
    http
      .expectOne('/api/users/driver-1/driver-rating')
      .flush({ code: 'USER_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await expect(rating).rejects.toBeInstanceOf(ApiError);

    const page = service.list('driver-1', 0, 10);
    http
      .expectOne((req) => req.url === '/api/users/driver-1/driver-reviews')
      .flush({ code: 'USER_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    await expect(page).rejects.toBeInstanceOf(ApiError);
  });
});
