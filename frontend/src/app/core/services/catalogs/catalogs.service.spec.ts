import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { CatalogsService } from './catalogs.service';

describe('CatalogsService', () => {
  let catalogs: CatalogsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    catalogs = TestBed.inject(CatalogsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the brands once and keeps them', async () => {
    const first = catalogs.vehicleBrandNames();
    const second = catalogs.vehicleBrandNames();
    http.expectOne('/api/catalogs/vehicle-brands?limit=100').flush([
      { key: 'abarth', name: 'Abarth' },
      { key: 'seat', name: 'SEAT' },
    ]);

    await expect(first).resolves.toEqual(['Abarth', 'SEAT']);
    await expect(second).resolves.toEqual(['Abarth', 'SEAT']);
    await expect(catalogs.vehicleBrandNames()).resolves.toEqual(['Abarth', 'SEAT']);
  });

  it('asks again after a failure', async () => {
    const failing = catalogs.vehicleBrandNames();
    http
      .expectOne('/api/catalogs/vehicle-brands?limit=100')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await expect(failing).rejects.toBeInstanceOf(ApiError);

    const retry = catalogs.vehicleBrandNames();
    http.expectOne('/api/catalogs/vehicle-brands?limit=100').flush([{ key: 'seat', name: 'SEAT' }]);
    await expect(retry).resolves.toEqual(['SEAT']);
  });
});
