import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminSettingsService } from './admin-settings.service';

const SETTINGS = { multiDayPublishing: false, updatedAt: null, updatedBy: null };

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the settings and changes only the ones sent', async () => {
    const read = service.get();
    http.expectOne('/api/admin/settings').flush(SETTINGS);
    await expect(read).resolves.toEqual(SETTINGS);

    const changed = service.update({ multiDayPublishing: true });
    const request = http.expectOne('/api/admin/settings');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ multiDayPublishing: true });
    request.flush({ ...SETTINGS, multiDayPublishing: true });
    await expect(changed).resolves.toMatchObject({ multiDayPublishing: true });
  });

  it('turns an HTTP error into an ApiError', async () => {
    const read = service.get();
    http
      .expectOne('/api/admin/settings')
      .flush(
        { '@type': 'Error', code: 'PROFILE_REQUIRED', status: '403' },
        { status: 403, statusText: 'Forbidden' },
      );

    await expect(read).rejects.toBeInstanceOf(ApiError);
  });
});
