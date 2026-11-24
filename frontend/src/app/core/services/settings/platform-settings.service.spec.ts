import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PlatformSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the platform settings', async () => {
    const read = service.get();
    http.expectOne('/api/settings').flush({ multiDayPublishing: true });

    await expect(read).resolves.toEqual({ multiDayPublishing: true });
  });

  it('turns an HTTP error into an ApiError', async () => {
    const read = service.get();
    http
      .expectOne('/api/settings')
      .flush(
        { '@type': 'Error', code: 'INVALID_ACCESS_TOKEN', status: '401' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expect(read).rejects.toBeInstanceOf(ApiError);
  });
});
