import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let adminUsers: AdminUsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    adminUsers = TestBed.inject(AdminUsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends only the filters in use and reads the total', async () => {
    const page = adminUsers.list({ search: 'ana', status: 'suspended', offset: 20, limit: 20 });
    http
      .expectOne('/api/admin/users?offset=20&limit=20&search=ana&status=suspended')
      .flush([{ id: 'u1' }], { headers: { 'X-Total-Count': '41' } });

    expect(await page).toEqual({ items: [{ id: 'u1' }], total: 41 });
  });

  it('counts the items without a total and throws an ApiError when it fails', async () => {
    const page = adminUsers.list({ offset: 0, limit: 20 });
    http.expectOne('/api/admin/users?offset=0&limit=20').flush([{ id: 'u1' }, { id: 'u2' }]);
    expect((await page).total).toBe(2);

    const failing = adminUsers.list({ profile: 'driver', offset: 0, limit: 20 });
    http
      .expectOne('/api/admin/users?offset=0&limit=20&profile=driver')
      .flush({ code: 'PROFILE_REQUIRED' }, { status: 403, statusText: 'Forbidden' });
    await expect(failing).rejects.toBeInstanceOf(ApiError);
  });

  it('gets a user and runs the admin actions with their reason', async () => {
    const detail = adminUsers.get('u1');
    http.expectOne('/api/admin/users/u1').flush({ id: 'u1' });
    expect(await detail).toEqual({ id: 'u1' });

    const change = adminUsers.setProfileActive('u1', {
      profile: 'driver',
      isActive: false,
      reason: 'Reported twice',
    });
    const put = http.expectOne('/api/users/u1/profiles/driver');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ isActive: false, reason: 'Reported twice' });
    put.flush({});
    await change;

    const lift = adminUsers.liftSuspension('u1', { role: 'passenger', reason: 'Strike day' });
    const post = http.expectOne('/api/admin/users/u1/suspensions/passenger/lift');
    expect(post.request.body).toEqual({ reason: 'Strike day' });
    post.flush(null, { status: 409, statusText: 'Conflict' });
    await expect(lift).rejects.toBeInstanceOf(ApiError);
  });
});
