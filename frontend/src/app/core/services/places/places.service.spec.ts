import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiError } from '../../models/api-error.model';
import { CampusParking } from '../../models/place.model';
import { PlacesService } from './places.service';

const P1: CampusParking = {
  id: 'p1',
  name: 'Parking P1',
  location: { type: 'Point', coordinates: [-2.4045, 36.8322] },
};

describe('PlacesService', () => {
  let places: PlacesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    places = TestBed.inject(PlacesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the campus parkings once', async () => {
    const first = places.loadParkings();
    const second = places.loadParkings();
    http.expectOne('/api/campus-parkings').flush([P1]);
    await Promise.all([first, second]);

    expect(places.parkings()).toEqual([P1]);
  });

  it('throws an ApiError and asks again for the parkings when they failed', async () => {
    const failed = places.loadParkings();
    http.expectOne('/api/campus-parkings').flush(null, { status: 503, statusText: 'Down' });
    await expect(failed).rejects.toMatchObject({ status: 503 });
    expect(places.parkings()).toEqual([]);

    const retry = places.loadParkings();
    http.expectOne('/api/campus-parkings').flush([P1]);
    await retry;
    expect(places.parkings()).toEqual([P1]);
  });

  it('suggests addresses for a text', async () => {
    const suggestions = firstValueFrom(places.suggest('mediterraneo'));
    const request = http.expectOne((req) => req.url === '/api/places');
    expect(request.request.params.get('q')).toBe('mediterraneo');
    expect(request.request.params.get('limit')).toBe('5');
    request.flush([{ id: 'a1', name: 'Avenida del Mediterraneo, 120', locality: 'Almería' }]);

    await expect(suggestions).resolves.toHaveLength(1);
  });

  it('gets the address of a point', async () => {
    const place = places.reverse([-2.4637, 36.8381]);
    const request = http.expectOne((req) => req.url === '/api/places/reverse');
    expect(request.request.params.get('lon')).toBe('-2.4637');
    expect(request.request.params.get('lat')).toBe('36.8381');
    request.flush({ id: 'b1', name: 'Calle Lachambre, 4', isCovered: true });

    await expect(place).resolves.toMatchObject({ name: 'Calle Lachambre, 4' });
  });

  it('gets the place of a suggestion', async () => {
    const place = places.getPlace('a1');
    http.expectOne('/api/places/a1').flush({ id: 'a1', isCovered: true });

    await expect(place).resolves.toMatchObject({ isCovered: true });
  });

  it('throws an ApiError when an address fails', async () => {
    const place = places.reverse([-2.4637, 36.8381]);
    http
      .expectOne((req) => req.url === '/api/places/reverse')
      .flush({ code: 'PLACE_NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

    await expect(place).rejects.toBeInstanceOf(ApiError);
    await expect(place).rejects.toMatchObject({ code: 'PLACE_NOT_FOUND', status: 404 });
  });
});
