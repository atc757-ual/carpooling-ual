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

  it('fetches current user profile with getMe', async () => {
    const mePromise = users.getMe();
    const req = http.expectOne('/api/users/me');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'user-1', name: 'Ana García' });

    await expect(mePromise).resolves.toMatchObject({ id: 'user-1', name: 'Ana García' });
  });

  it('updates current user with updateMe', async () => {
    const updatePromise = users.updateMe({
      name: 'Ana G.',
      bio: 'Estudiante de Informática en la UAL',
    });
    const req = http.expectOne('/api/users/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      name: 'Ana G.',
      bio: 'Estudiante de Informática en la UAL',
    });
    req.flush({ id: 'user-1', name: 'Ana G.' });

    await expect(updatePromise).resolves.toMatchObject({ id: 'user-1', name: 'Ana G.' });
  });

  it('asks for the SMS code and confirms it', async () => {
    const asked = users.requestPhoneVerification();
    const askReq = http.expectOne('/api/users/me/phone-verification');
    expect(askReq.request.method).toBe('POST');
    askReq.flush(null);
    await asked;

    const confirmed = users.confirmPhoneVerification('123456');
    const confirmReq = http.expectOne('/api/users/me/phone-verification/confirm');
    expect(confirmReq.request.body).toEqual({ code: '123456' });
    confirmReq.flush({ id: 'u1', phoneVerified: true });

    await expect(confirmed).resolves.toMatchObject({ phoneVerified: true });
  });

  it('fetches user consents with getMyConsents', async () => {
    const consentsPromise = users.getMyConsents();
    const req = http.expectOne('/api/users/me/consents');
    expect(req.request.method).toBe('GET');
    req.flush({ current: { terms: null, privacy: null, location: null }, history: [] });

    await expect(consentsPromise).resolves.toMatchObject({ history: [] });
  });

  it('updates location consent with setLocationConsent', async () => {
    const setPromise = users.setLocationConsent('granted');
    const req = http.expectOne('/api/users/me/consents/location');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ action: 'granted', source: 'settings' });
    req.flush({ current: { location: { action: 'granted' } }, history: [] });

    await expect(setPromise).resolves.toMatchObject({
      current: { location: { action: 'granted' } },
    });
  });

  it('sends the version of the location text that was accepted', async () => {
    const setPromise = users.setLocationConsent('granted', 'location_prompt', '2.0');
    const req = http.expectOne('/api/users/me/consents/location');
    expect(req.request.body).toEqual({
      action: 'granted',
      source: 'location_prompt',
      version: '2.0',
    });
    req.flush({ current: { location: { action: 'granted' } }, outdated: [], history: [] });

    await setPromise;
  });

  it('records where the location consent was given', async () => {
    const setPromise = users.setLocationConsent('granted', 'location_prompt');
    const req = http.expectOne('/api/users/me/consents/location');
    expect(req.request.body).toEqual({ action: 'granted', source: 'location_prompt' });
    req.flush({ current: { location: { action: 'granted' } }, history: [] });

    await setPromise;
  });
  it('requests account deletion code', async () => {
    const requestPromise = users.requestAccountDeletion();
    const req = http.expectOne('/api/users/me/account-deletion');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(null);

    await expect(requestPromise).resolves.toBeNull();
  });

  it('verifies account deletion code without consuming it', async () => {
    const verifyPromise = users.verifyAccountDeletionCode('123456');
    const req = http.expectOne('/api/users/me/account-deletion/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush(null);

    await expect(verifyPromise).resolves.toBeNull();
  });

  it('confirms account deletion with code', async () => {
    const confirmPromise = users.confirmAccountDeletion('123456');
    const req = http.expectOne('/api/users/me/account-deletion/confirm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush(null);

    await expect(confirmPromise).resolves.toBeNull();
  });
});
