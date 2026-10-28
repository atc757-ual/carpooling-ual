import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let users: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    users = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('activates one of my profiles', async () => {
    const activate = users.activateProfile('driver');
    const request = http.expectOne('/api/users/me/profiles/driver');
    expect(request.request.method).toBe('PUT');
    request.flush({ id: 'user-1', profiles: ['driver'] });

    await expect(activate).resolves.toMatchObject({ profiles: ['driver'] });
  });

  it('keeps the active mode on the server', async () => {
    const change = users.setActiveMode('driver');
    const request = http.expectOne('/api/users/me/active-mode');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ mode: 'driver' });
    request.flush({ id: 'user-1', activeMode: 'driver' });

    await expect(change).resolves.toMatchObject({ activeMode: 'driver' });
  });

  it('rejects with the API error', async () => {
    const activate = users.activateProfile('driver');
    http
      .expectOne('/api/users/me/profiles/driver')
      .flush({ code: 'PROFILE_DEACTIVATED_BY_ADMIN' }, { status: 409, statusText: 'Conflict' });

    await expect(activate).rejects.toMatchObject({ code: 'PROFILE_DEACTIVATED_BY_ADMIN' });
  });
});
